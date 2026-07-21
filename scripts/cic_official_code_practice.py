#!/usr/bin/env python3
"""Run a CPU-only smoke audit against the official CIC implementation."""

from __future__ import annotations

import argparse
import importlib
import json
import os
import subprocess
import sys
import types
from pathlib import Path
from typing import Iterable

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
os.environ.setdefault("MPLBACKEND", "Agg")

import matplotlib.pyplot as plt
import numpy as np
import torch


EXPECTED_COMMIT = "b523c3884256346cb585bf06e52a7aadc127dcfc"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit CIC tensor shapes, gradients, reward, and skill boundaries."
    )
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--plot-path", type=Path)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--obs-dim", type=int, default=24)
    parser.add_argument("--action-dim", type=int, default=6)
    parser.add_argument("--hidden-dim", type=int, default=128)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--allow-different-commit", action="store_true")
    return parser.parse_args()


def git_head(repo: Path) -> str:
    return subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True
    ).strip()


def install_dm_env_stub() -> None:
    try:
        importlib.import_module("dm_env")
        return
    except ModuleNotFoundError:
        pass

    dm_env = types.ModuleType("dm_env")
    dm_env.specs = types.SimpleNamespace(
        Array=lambda shape, dtype, name: types.SimpleNamespace(
            shape=shape, dtype=dtype, name=name
        )
    )
    sys.modules["dm_env"] = dm_env


def import_official_cic(repo: Path):
    install_dm_env_stub()
    sys.path.insert(0, str(repo))
    module = importlib.import_module("agent.cic")
    module.device = torch.device("cpu")
    module.rms = module.RMS()
    return module


def make_agent(module, args: argparse.Namespace):
    return module.CICAgent(
        update_skill_every_step=50,
        skill_dim=64,
        scale=1.0,
        project_skill=True,
        rew_type="og",
        update_rep=True,
        temp=0.5,
        name="cic",
        reward_free=True,
        obs_type="states",
        obs_shape=(args.obs_dim,),
        action_shape=(args.action_dim,),
        device=torch.device("cpu"),
        lr=1e-4,
        feature_dim=args.hidden_dim,
        hidden_dim=args.hidden_dim,
        critic_target_tau=0.01,
        num_expl_steps=4000,
        update_every_steps=1,
        stddev_schedule=0.2,
        nstep=3,
        batch_size=args.batch_size,
        stddev_clip=0.3,
        init_critic=True,
        use_tb=False,
        use_wandb=False,
    )


def clone_params(module: torch.nn.Module) -> list[torch.Tensor]:
    return [param.detach().clone() for param in module.parameters()]


def parameter_delta(before: Iterable[torch.Tensor], module: torch.nn.Module) -> float:
    total = 0.0
    for old, new in zip(before, module.parameters()):
        total += torch.sum((new.detach() - old) ** 2).item()
    return float(total**0.5)


def make_batch(args: argparse.Namespace):
    batch_size = args.batch_size
    obs = torch.randn(batch_size, args.obs_dim)
    drift = torch.linspace(0.0, 0.35, batch_size).unsqueeze(1)
    next_obs = obs + 0.05 * torch.randn_like(obs) + drift
    skill = torch.rand(batch_size, 64)
    action = torch.tanh(torch.randn(batch_size, args.action_dim))
    extr_reward = torch.zeros(batch_size, 1)
    discount = torch.full((batch_size, 1), 0.99**3)
    return obs, action, extr_reward, discount, next_obs, skill


def numpy_replay_batch(batch):
    return tuple(item.detach().cpu().numpy().astype(np.float32) for item in batch)


def boundary_audit(horizon: int = 50, num_steps: int = 120):
    stored_meta = ["reset"]
    action_skill = [None]
    current = "reset"

    for step in range(num_steps):
        if step % horizon == 0:
            current = f"z@{step}"
        action_skill.append(current)
        stored_meta.append(current)

    rows = []
    for idx in range(1, num_steps + 1):
        sampled = stored_meta[idx - 1]
        acted = action_skill[idx]
        rows.append(
            {
                "transition_index": idx,
                "action_skill": acted,
                "sampled_skill": sampled,
                "mismatch": acted != sampled,
            }
        )
    return rows


def save_plot(
    output_path: Path,
    logits: np.ndarray,
    reward: np.ndarray,
    cpc_deltas: dict[str, float],
    boundary_rows: list[dict],
) -> None:
    plt.style.use("dark_background")
    fig, axes = plt.subplots(2, 2, figsize=(12, 8), constrained_layout=True)
    fig.patch.set_facecolor("#0d1017")

    ax = axes[0, 0]
    image = ax.imshow(logits, cmap="magma", aspect="auto")
    ax.set_title("CPC similarity matrix")
    ax.set_xlabel("transition key j")
    ax.set_ylabel("skill query i")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)

    ax = axes[0, 1]
    ax.hist(reward, bins=12, color="#54d2d2", edgecolor="#11151e")
    ax.axvline(float(np.mean(reward)), color="#f3c969", linewidth=2)
    ax.set_title("k-NN intrinsic reward")
    ax.set_xlabel("reward")
    ax.set_ylabel("samples")

    ax = axes[1, 0]
    labels = list(cpc_deltas)
    values = [cpc_deltas[label] for label in labels]
    plot_values = [max(value, 1e-16) for value in values]
    colors = ["#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#fb923c", "#54d2d2"]
    bars = ax.bar(labels, plot_values, color=colors[: len(labels)])
    ax.set_yscale("log")
    ax.set_title("Parameter delta after update_cic()")
    ax.set_ylabel("L2 parameter change")
    ax.tick_params(axis="x", rotation=28)
    for bar, value in zip(bars, values):
        label = "0" if value == 0 else f"{value:.1e}"
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() * 1.3, label,
                ha="center", va="bottom", fontsize=8)

    ax = axes[1, 1]
    indices = [row["transition_index"] for row in boundary_rows]
    mismatch = [int(row["mismatch"]) for row in boundary_rows]
    ax.step(indices, mismatch, where="mid", color="#7f8798")
    mismatch_indices = [index for index, value in zip(indices, mismatch) if value]
    ax.scatter(mismatch_indices, [1] * len(mismatch_indices), color="#fb5f5f", s=60, zorder=3)
    ax.set_yticks([0, 1], labels=["aligned", "mismatch"])
    ax.set_ylim(-0.2, 1.3)
    ax.set_title("Replay skill at 50-step boundaries")
    ax.set_xlabel("transition index")

    for ax in axes.flat:
        ax.set_facecolor("#11151e")
        ax.grid(alpha=0.15)

    fig.suptitle("CIC official-code smoke practice", fontsize=18, fontweight="bold")
    fig.savefig(output_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)


def main() -> None:
    args = parse_args()
    args.repo = args.repo.resolve()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.plot_path is not None:
        args.plot_path.parent.mkdir(parents=True, exist_ok=True)

    if args.batch_size < 16:
        raise ValueError("batch-size must be at least 16 because official k-NN uses k=16")

    commit = git_head(args.repo)
    if commit != EXPECTED_COMMIT and not args.allow_different_commit:
        raise RuntimeError(f"expected {EXPECTED_COMMIT}, found {commit}")

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    torch.set_num_threads(1)

    cic_module = import_official_cic(args.repo)
    agent = make_agent(cic_module, args)
    obs, action, extr_reward, discount, next_obs, skill = make_batch(args)

    with torch.no_grad():
        query, key = agent.cic(obs, next_obs, skill)
    loss, logits = agent.compute_cpc_loss(obs, next_obs, skill)

    before_modules = {
        "state_net": clone_params(agent.cic.state_net),
        "next_state_net": clone_params(agent.cic.next_state_net),
        "skill_net": clone_params(agent.cic.skill_net),
        "pred_net": clone_params(agent.cic.pred_net),
        "actor": clone_params(agent.actor),
        "critic": clone_params(agent.critic),
    }
    agent.update_cic(obs, skill, next_obs, step=0)
    cpc_deltas = {
        name: parameter_delta(before_modules[name], getattr(agent.cic, name)
                              if hasattr(agent.cic, name) else getattr(agent, name))
        for name in before_modules
    }

    with torch.no_grad():
        state_embedding = agent.cic.state_net(next_obs)
        distance = torch.norm(
            state_embedding[:, None, :] - state_embedding[None, :, :], dim=-1, p=2
        )
        knn_distance, _ = distance.topk(16, dim=1, largest=False, sorted=True)
        reward = agent.compute_apt_reward(next_obs, next_obs).squeeze(1)

    before_full = {
        "cic": clone_params(agent.cic),
        "actor": clone_params(agent.actor),
        "critic": clone_params(agent.critic),
    }
    agent.update(iter([numpy_replay_batch((obs, action, extr_reward, discount, next_obs, skill))]), step=1)
    full_update_deltas = {
        name: parameter_delta(before_full[name], getattr(agent, name))
        for name in before_full
    }

    logging_error = None
    agent.use_tb = True
    try:
        agent.update(
            iter([numpy_replay_batch((obs, action, extr_reward, discount, next_obs, skill))]),
            step=2,
        )
    except Exception as error:  # Capture the official metric branch failure verbatim.
        logging_error = f"{type(error).__name__}: {error}"
    finally:
        agent.use_tb = False

    boundary_rows = boundary_audit()
    mismatch_indices = [
        row["transition_index"] for row in boundary_rows if row["mismatch"]
    ]

    summary = {
        "source_commit": commit,
        "seed": args.seed,
        "device": "cpu",
        "batch_size": args.batch_size,
        "obs_dim": args.obs_dim,
        "action_dim": args.action_dim,
        "skill_dim": 64,
        "tensor_shapes": {
            "query": list(query.shape),
            "key": list(key.shape),
            "similarity": list(logits.shape),
            "intrinsic_reward": list(reward.unsqueeze(1).shape),
        },
        "cpc_loss": {
            "mean": float(loss.mean().detach()),
            "min": float(loss.min().detach()),
            "max": float(loss.max().detach()),
            "finite": bool(torch.isfinite(loss).all()),
        },
        "intrinsic_reward": {
            "mean": float(reward.mean()),
            "min": float(reward.min()),
            "max": float(reward.max()),
            "finite": bool(torch.isfinite(reward).all()),
            "nearest_self_distance_max": float(knn_distance[:, 0].max()),
        },
        "parameter_delta_after_update_cic": cpc_deltas,
        "parameter_delta_after_full_update": full_update_deltas,
        "logging_branch_error": logging_error,
        "skill_boundary_mismatch_indices": mismatch_indices,
        "notes": [
            "Official modules are imported directly from the pinned repository.",
            "dm_env.specs is stubbed because this smoke test does not create an environment.",
            "The boundary audit mirrors pretrain.py storage timing and replay_buffer.py indexing.",
        ],
    }

    summary_path = args.output_dir / "summary.json"
    plot_path = args.plot_path or (args.output_dir / "practice_results.png")
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    save_plot(
        plot_path,
        logits.detach().cpu().numpy(),
        reward.detach().cpu().numpy(),
        cpc_deltas,
        boundary_rows,
    )

    print(json.dumps(summary, indent=2))
    print(f"summary: {summary_path}")
    print(f"plot: {plot_path}")


if __name__ == "__main__":
    main()
