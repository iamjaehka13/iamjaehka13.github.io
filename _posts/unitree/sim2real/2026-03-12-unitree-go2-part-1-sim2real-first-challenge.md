---
title: "[Unitree Go2 part 1] Sim2Real에 처음 도전하다."
date: 2026-03-12 14:28:00 +0900
last_modified_at: 2026-03-23 22:34:27 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, isaac-sim, deployment]
description: What is this project
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif
math: true
---

What is this project
====================

이 프로젝트는 Unitree Go2의 로봇개를 구매한후 25년 12월 부터 구상하기 시작해서 현재까지 이르게 되었다.

이 프로젝트에 대해서 간단하게 설명 하자면 go2 로봇의 /lowstate에 로봇 각 모터의 현재 온도와 토크 같은 정보가 들어 있는데 이를 활용하여 **보행시에 온도를 높이지 않고 부담이 많이가는 모터를 인지**하여 스스로 **건강을 관리하는 “강화학습” 모델**을 만든는 것이다!

What is Plan
------------

계획을 세웠다면 이를 이루기 위한 계획이 필요하다. 첫번째로는 Baseline을 정하는 것이다.

베이스라인의 기준은 아래와 같았다.

1.  Unitree Go2 모델을 Real에서 걷게 할 수 있는 RL 보행 모델일 것.
    1.  나중에 sim2real gap을 매꾸기가 어려울 것을 알고 있었기 때문에 나중에 이것저것 설정을 추가할 것을 고려해서 가장 basic한 reference를 찾았다.
2.  Isaaclab이나 Unitree에서 배포한 env 환경설정을 따를 것.

결론적으로 Baseline으로 unitree 사에서 내놓은 Unitree_rl_lab을 따르기로 했다.

<https://github.com/unitreerobotics/unitree_rl_lab>

1.  Unitree 사에서 직접 배포한 repo인 만큼 사용 설명이 잘 정리되어 있었고 많은 사람이 시도해 보았기 때문에 잔 버그가 없을 것 같았다.
2.  g1 휴머노이드 모델이 real에서 잘 걷는 것을 보고 이 정책대로만 학습하면 go2도 잘 걸을 수 있을 것이라 생각하였다.
3.  무엇보다 unitree sdk2와 연동이 잘 되어있어 재현하기가 쉬울 것 같았다.

IsaacSim train
==============

simulation 상에서 train 하는 것 자체는 매우 쉬웠다. 일단 처음 학습해보는 것인 만큼 기본 설정대로 iteration을 10000번만큼 학습하였다.

```bash
python scripts/rsl_rl/train.py --headless --task Unitree-Go2-Velocity --video --video_interval 1000 --num_envs 4096 --seed 42 --max_iterations 10000
```

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif){.popup .img-link .shimmer}

-   — video 옵션을 주어 학습중에 자동으로 비디오가 저장되게 하였고 영상 속에서는 학습 결과가 나쁘지 않은 것처럼 보였다!

trained model depoly
--------------------

원래는 sim2sim으로 cpu기반 시뮬레이터인 **mujoco**에서 테스트를 해보아야 했지만 train 결과가 너무 좋아보였기 때문에 바로 실제 로봇에 deploy 해보기로 결정했다.

### unitree python sdk

모델을 depoly 하기 위해 /lowstate 토픽에서 joint_pose, joint_vel, imu, 압력센서, last_action등을 observation으로 하고 이를 onnx 모델에서 추론하여 50hz로 action을 /lowcmd 로 발행하였습니다.

-   Joint Pos : $q_{rel} = q - \text{default joint pos}$
-   joint Vel : $dq$
-   base_ang_vel : $\text{imu (gyroscope)} : [w_x, w_y, w_z]$
-   Projected gravity : $g_{body} = R(q)^T \cdot \begin{bmatrix} 0 \ 0 \ -1 \end{bmatrix}$
-   velocity command : keyboard input

<details markdown="1">
<summary>code base</summary>

```python
import argparse
import math
import threading
import time
import sys
import select
from typing import Callable, Dict, List

import numpy as np
import yaml

from unitree_sdk2py.core.channel import ChannelFactoryInitialize
from unitree_sdk2py.core.channel import ChannelPublisher, ChannelSubscriber
from unitree_sdk2py.idl.default import unitree_go_msg_dds__LowCmd_, unitree_go_msg_dds__LowState_
from unitree_sdk2py.idl.unitree_go.msg.dds_ import LowCmd_
from unitree_sdk2py.idl.unitree_go.msg.dds_ import LowState_
from unitree_sdk2py.utils.crc import CRC
from unitree_sdk2py.utils.thread import RecurrentThread
from unitree_sdk2py.comm.motion_switcher.motion_switcher_client import MotionSwitcherClient
from unitree_sdk2py.go2.sport.sport_client import SportClient
import unitree_legged_const as go2

try:
    import onnxruntime as ort
except ModuleNotFoundError as exc:
    raise RuntimeError(
        "onnxruntime is required. install with: python -m pip install onnxruntime"
    ) from exc

try:
    import termios
    import tty
except ImportError:  # pragma: no cover - non-posix fallback
    termios = None
    tty = None


DEFAULT_DEPLOY_YAML = "/home/loe/workspace/github/unitree_rl_lab/logs/rsl_rl/unitree_go2_velocity/2026-03-10_00-08-13/params/deploy.yaml"
DEFAULT_ONNX = "/home/loe/workspace/github/unitree_rl_lab/logs/rsl_rl/unitree_go2_velocity/2026-03-10_00-08-13/exported/policy.onnx"


def _ensure_float_array(value, size: int | None = None) -> np.ndarray:
    if isinstance(value, (int, float)):
        arr = np.array([value], dtype=np.float32)
    else:
        arr = np.array(value, dtype=np.float32)
    if arr.ndim != 1:
        arr = arr.reshape(-1)
    if size is not None:
        if arr.size == 1 and size > 1:
            arr = np.full(size, float(arr[0]), dtype=np.float32)
        elif arr.size != size:
            raise ValueError(f"expected size={size}, got={arr.size}")
    return arr


def _scale_and_clip(values: np.ndarray, scale: float | list[float], clip: list[float] | tuple[float, float] | None):
    if isinstance(scale, (int, float)):
        values = values * float(scale)
    else:
        s = _ensure_float_array(scale, values.size)
        values = values * s

    if clip is not None:
        lo, hi = clip
        values = np.clip(values, float(lo), float(hi))
    return values


# def _quat_to_gravity_body(q: List[float], order: str) -> np.ndarray:
#     # q is assumed unit-length quaternion
#     if q is None or len(q) < 4:
#         return np.array([0.0, 0.0, -1.0], dtype=np.float32)

#     if order == "wxyz":
#         w, x, y, z = [float(v) for v in q[:4]]
#     else:
#         x, y, z, w = [float(v) for v in q[:4]]

#     n2 = w * w + x * x + y * y + z * z
#     if n2 < 1e-8:
#         return np.array([0.0, 0.0, -1.0], dtype=np.float32)
#     inv_n = 1.0 / math.sqrt(n2)
#     w, x, y, z = w * inv_n, x * inv_n, y * inv_n, z * inv_n

#     # base(=body) to world rotation matrix from quaternion.
#     # projected gravity in body frame = R^T @ [0,0,-1]
#     # this becomes [-R02, -R12, -R22]
#     r02 = 2.0 * (x * z + y * w)
#     r12 = 2.0 * (y * z - x * w)
#     r22 = 1.0 - 2.0 * (x * x + y * y)
#     return np.array([-r02, -r12, -r22], dtype=np.float32)

def _quat_to_gravity_body(q, order: str) -> np.ndarray:
    if q is None or len(q) < 4:
        return np.array([0.0, 0.0, -1.0], dtype=np.float32)

    if order == "wxyz":
        w, x, y, z = [float(v) for v in q[:4]]
    else:
        x, y, z, w = [float(v) for v in q[:4]]

    n2 = w * w + x * x + y * y + z * z
    if n2 < 1e-8:
        return np.array([0.0, 0.0, -1.0], dtype=np.float32)

    inv_n = 1.0 / math.sqrt(n2)
    w, x, y, z = w * inv_n, x * inv_n, y * inv_n, z * inv_n

    # correct: R^T @ [0,0,-1] = [-R20, -R21, -R22]
    gx = 2.0 * (x * z - y * w)
    gy = 2.0 * (y * z + x * w)
    gz = 1.0 - 2.0 * (x * x + y * y)

    return np.array([-gx, -gy, -gz], dtype=np.float32)

class KeyboardController:
    def __init__(
        self,
        example: "Go2RlExample",
        step_x: float = 0.05,
        step_y: float = 0.05,
        step_z: float = 0.10,
    ):
        self.example = example
        self.step_x = float(step_x)
        self.step_y = float(step_y)
        self.step_z = float(step_z)
        self._thread: threading.Thread | None = None
        self._running = False
        self._old_tty_settings = None

    def start(self):
        if sys.stdin is None or not sys.stdin.isatty():
            print("[WARN] stdin is not a tty; keyboard control is disabled.")
            return
        if termios is None or tty is None:
            print("[WARN] termios/tty is not available; keyboard control is disabled.")
            return

        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="go2_keyboard")
        self._thread.start()
        print("[INFO] Keyboard control enabled: w/s=+/- vx, a/d=+/- vy, q/e=+/- wz, space=reset")

    def stop(self):
        self._running = False
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        self._restore_terminal()

    def _restore_terminal(self):
        if self._old_tty_settings is not None and sys.stdin is not None and termios is not None:
            try:
                fd = sys.stdin.fileno()
                termios.tcsetattr(fd, termios.TCSADRAIN, self._old_tty_settings)
            except Exception:
                pass
            self._old_tty_settings = None

    def _run(self):
        fd = sys.stdin.fileno()
        self._old_tty_settings = termios.tcgetattr(fd)
        tty.setcbreak(fd)
        try:
            while self._running:
                readable, _, _ = select.select([sys.stdin], [], [], 0.05)
                if not readable:
                    continue

                ch = sys.stdin.read(1).lower()
                if ch == "w":
                    self.example.update_command_delta(self.step_x, 0.0, 0.0)
                elif ch == "s":
                    self.example.update_command_delta(-self.step_x, 0.0, 0.0)
                elif ch == "a":
                    self.example.update_command_delta(0.0, self.step_y, 0.0)
                elif ch == "d":
                    self.example.update_command_delta(0.0, -self.step_y, 0.0)
                elif ch == "q":
                    self.example.update_command_delta(0.0, 0.0, self.step_z)
                elif ch == "e":
                    self.example.update_command_delta(0.0, 0.0, -self.step_z)
                elif ch == " ":
                    self.example.set_command(0.0, 0.0, 0.0)
                elif ch == "\x03":
                    self._running = False
                self._print_command()
        finally:
            self._restore_terminal()

    def _print_command(self):
        cmd = self.example.get_command()
        print(f"\rcommand -> vx:{cmd[0]:+.2f}, vy:{cmd[1]:+.2f}, wz:{cmd[2]:+.2f}", end="", flush=True)


class Go2RlExample:
    def __init__(
        self,
        onnx_path: str,
        deploy_cfg_path: str,
        quat_order: str = "wxyz",
        command: tuple[float, float, float] = (0.0, 0.0, 0.0),
        control_dt: float | None = None,
    ):
        self.cmd_lin_x, self.cmd_lin_y, self.cmd_ang = command
        self.quat_order = quat_order

        self.low_state: LowState_ | None = None
        self._state_lock = threading.Lock()
        self._command_lock = threading.Lock()

        self.low_cmd = unitree_go_msg_dds__LowCmd_()
        self.crc = CRC()

        self.cfg = self._load_yaml(deploy_cfg_path)
        self.joint_ids_map = np.array(self.cfg["joint_ids_map"], dtype=np.int32)
        self.stiffness = _ensure_float_array(self.cfg.get("stiffness", np.ones(len(self.joint_ids_map))), len(self.joint_ids_map))
        self.damping = _ensure_float_array(self.cfg.get("damping", np.ones(len(self.joint_ids_map))), len(self.joint_ids_map))
        self.default_joint_pos = _ensure_float_array(self.cfg.get("default_joint_pos", np.zeros(len(self.joint_ids_map))), len(self.joint_ids_map))

        self.actions_cfg = self.cfg["actions"]["JointPositionAction"]
        self.action_clip = self.actions_cfg.get("clip", [-100.0, 100.0])
        self.action_scale = _ensure_float_array(self.actions_cfg.get("scale", 1.0), len(self.joint_ids_map))
        self.action_offset = _ensure_float_array(self.actions_cfg.get("offset", 0.0), len(self.joint_ids_map))
        self.action_dim = len(self.joint_ids_map)

        self.obs_cfg = self.cfg["observations"]
        self.obs_term_builders: list[tuple[str, Dict]] = []
        for name, term in self.obs_cfg.items():
            if term.get("history_length", 1) != 1:
                # current sample does not keep history buffer
                pass
            self.obs_term_builders.append((name, term))

        command_cfg = self.cfg.get("commands", {}).get("base_velocity", {})
        self.command_limits = command_cfg.get("ranges", {"lin_vel_x": [-1.0, 1.0], "lin_vel_y": [-0.4, 0.4], "ang_vel_z": [-1.0, 1.0]})

        self.last_action = np.zeros(self.action_dim, dtype=np.float32)
        self.last_infer_time = time.time()

        self._init_onnx(onnx_path)
        self._init_dof_cmd()
        self._init_communication()
        self._init_robot_mode()

        self.control_dt = float(control_dt) if control_dt is not None else float(self.cfg.get("step_dt", 0.02))
        self._control_thread: RecurrentThread | None = None

    @staticmethod
    def _load_yaml(path: str) -> Dict:
        with open(path, "r") as f:
            cfg = yaml.safe_load(f)
        if not isinstance(cfg, dict):
            raise RuntimeError(f"{path} does not contain a valid yaml dict")
        return cfg

    def _init_onnx(self, onnx_path: str):
        self.ort_session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        self.ort_input_name = self.ort_session.get_inputs()[0].name
        self.ort_output_name = self.ort_session.get_outputs()[0].name
        input_shape = self.ort_session.get_inputs()[0].shape
        output_shape = self.ort_session.get_outputs()[0].shape
        if input_shape is not None and len(input_shape) >= 2 and isinstance(input_shape[1], int):
            if input_shape[1] != self.observation_dim:
                raise RuntimeError(
                    f"ONNX input dim mismatch: model expects {input_shape[1]}, "
                    f"but current observation dim is {self.observation_dim}"
                )
        if output_shape is not None and len(output_shape) >= 2 and isinstance(output_shape[1], int):
            if output_shape[1] != self.action_dim:
                raise RuntimeError(
                    f"ONNX output dim mismatch: model outputs {output_shape[1]}, "
                    f"but action dim is {self.action_dim}"
                )

    @property
    def observation_dim(self) -> int:
        if not hasattr(self, "_observation_dim"):
            dim = 0
            for name, term in self.obs_term_builders:
                if name == "base_ang_vel":
                    dim += 3
                elif name == "projected_gravity":
                    dim += 3
                elif name == "velocity_commands":
                    dim += 3
                elif name in {"joint_pos_rel", "joint_vel_rel", "last_action"}:
                    dim += self.action_dim
                else:
                    raise RuntimeError(f"Unsupported observation term: {name}")
            self._observation_dim = int(dim)
        return self._observation_dim

    def _init_dof_cmd(self):
        self.low_cmd.head[0] = 0xFE
        self.low_cmd.head[1] = 0xEF
        self.low_cmd.level_flag = 0xFF
        self.low_cmd.gpio = 0
        for i in range(20):
            self.low_cmd.motor_cmd[i].mode = 0x01
            self.low_cmd.motor_cmd[i].q = go2.PosStopF
            self.low_cmd.motor_cmd[i].dq = go2.VelStopF
            self.low_cmd.motor_cmd[i].kp = 0.0
            self.low_cmd.motor_cmd[i].kd = 0.0
            self.low_cmd.motor_cmd[i].tau = 0.0

    def _init_communication(self):
        self.lowcmd_publisher = ChannelPublisher("rt/lowcmd", LowCmd_)
        self.lowcmd_publisher.Init()
        self.lowstate_subscriber = ChannelSubscriber("rt/lowstate", LowState_)
        self.lowstate_subscriber.Init(self.LowStateMessageHandler, 10)

        self.sc = SportClient()
        self.sc.SetTimeout(5.0)
        self.sc.Init()

        self.msc = MotionSwitcherClient()
        self.msc.SetTimeout(5.0)
        self.msc.Init()

    def _init_robot_mode(self):
        status, result = self.msc.CheckMode()
        while result["name"]:
            self.sc.StandDown()
            self.msc.ReleaseMode()
            time.sleep(1.0)
            status, result = self.msc.CheckMode()
        if status != 0:
            print(f"[WARN] Motion switcher status={status}, result={result}")

    def LowStateMessageHandler(self, msg: LowState_):
        with self._state_lock:
            self.low_state = msg

    def _clip_command(self, cmd: tuple[float, float, float]) -> List[float]:
        cx, cy, cz = cmd
        cx_range = self.command_limits.get("lin_vel_x", (-1.0, 1.0))
        cy_range = self.command_limits.get("lin_vel_y", (-0.4, 0.4))
        cz_range = self.command_limits.get("ang_vel_z", (-1.0, 1.0))
        cx = float(np.clip(cx, cx_range[0], cx_range[1]))
        cy = float(np.clip(cy, cy_range[0], cy_range[1]))
        cz = float(np.clip(cz, cz_range[0], cz_range[1]))
        return [cx, cy, cz]

    def get_command(self) -> tuple[float, float, float]:
        with self._command_lock:
            return self.cmd_lin_x, self.cmd_lin_y, self.cmd_ang

    def set_command(self, cmd_x: float, cmd_y: float, cmd_z: float):
        with self._command_lock:
            self.cmd_lin_x, self.cmd_lin_y, self.cmd_ang = self._clip_command((cmd_x, cmd_y, cmd_z))

    def update_command_delta(self, dx: float, dy: float, dz: float):
        with self._command_lock:
            cmd = self._clip_command(
                (
                    self.cmd_lin_x + dx,
                    self.cmd_lin_y + dy,
                    self.cmd_ang + dz,
                )
            )
            self.cmd_lin_x, self.cmd_lin_y, self.cmd_ang = cmd

    def _get_joint_observations(self) -> tuple[np.ndarray, np.ndarray]:
        with self._state_lock:
            msg = self.low_state
        if msg is None:
            return None, None
        q = np.empty(self.action_dim, dtype=np.float32)
        dq = np.empty(self.action_dim, dtype=np.float32)
        for i, motor_idx in enumerate(self.joint_ids_map):
            joint_state = msg.motor_state[int(motor_idx)]
            q[i] = float(joint_state.q)
            dq[i] = float(joint_state.dq)
        return q, dq

    def _build_observation(self) -> np.ndarray | None:
        with self._state_lock:
            msg = self.low_state
        if msg is None:
            return None

        q, dq = self._get_joint_observations()
        if q is None or dq is None:
            return None

        base_ang_vel = np.array([float(v) for v in msg.imu_state.gyroscope], dtype=np.float32)
        projected_gravity = _quat_to_gravity_body(msg.imu_state.quaternion, self.quat_order)

        obs = []
        cmd = np.array(self._clip_command(self.get_command()), dtype=np.float32)
        for name, term in self.obs_term_builders:
            if name == "base_ang_vel":
                term_val = base_ang_vel
            elif name == "projected_gravity":
                term_val = projected_gravity
            elif name == "velocity_commands":
                term_val = cmd
            elif name == "joint_pos_rel":
                term_val = q - self.default_joint_pos
            elif name == "joint_vel_rel":
                term_val = dq
            elif name == "last_action":
                term_val = self.last_action
            else:
                raise RuntimeError(f"Unsupported observation term: {name}")

            term_scale = term.get("scale", 1.0)
            term_clip = term.get("clip", None)
            obs.extend(_scale_and_clip(term_val, term_scale, term_clip).tolist())
        return np.array(obs, dtype=np.float32).reshape(1, -1)

    def _infer(self, observation: np.ndarray) -> np.ndarray:
        action_raw = self.ort_session.run([self.ort_output_name], {self.ort_input_name: observation})[0]
        if isinstance(action_raw, list):
            action_raw = action_raw[0]
        action_raw = np.asarray(action_raw, dtype=np.float32).reshape(-1)
        if action_raw.size != self.action_dim:
            raise RuntimeError(f"Unexpected action size: {action_raw.size}, expected {self.action_dim}")
        return action_raw

    def _postprocess_action(self, raw_action: np.ndarray) -> np.ndarray:
        action = raw_action.astype(np.float32)
        if self.action_clip is not None:
            first_clip = self.action_clip[0]
            if isinstance(first_clip, (list, tuple)):
                clip_low = np.array([float(v[0]) for v in self.action_clip], dtype=np.float32)
                clip_hi = np.array([float(v[1]) for v in self.action_clip], dtype=np.float32)
                action = np.clip(action, clip_low, clip_hi)
            else:
                action = np.clip(action, float(self.action_clip[0]), float(self.action_clip[1]))
        action = action * self.action_scale + self.action_offset
        return action.astype(np.float32)

    def _publish_lowcmd(self, action: np.ndarray):
        # action is already mapped to the same order as deploy.yaml observations/actions.
        for i, motor_idx in enumerate(self.joint_ids_map):
            idx = int(motor_idx)
            cmd = self.low_cmd.motor_cmd[idx]
            cmd.mode = 0x01
            cmd.q = float(action[i])
            cmd.dq = go2.VelStopF
            cmd.kp = float(self.stiffness[i])
            cmd.kd = float(self.damping[i])
            cmd.tau = 0.0

        self.low_cmd.crc = self.crc.Crc(self.low_cmd)
        self.lowcmd_publisher.Write(self.low_cmd)

    def RunOnce(self):
        observation = self._build_observation()
        if observation is None:
            return

        raw_action = self._infer(observation)
        action = self._postprocess_action(raw_action)

        self.last_action = action.copy()
        self._publish_lowcmd(action)
        self.last_infer_time = time.time()

    def Start(self):
        self._control_thread = RecurrentThread(
            interval=self.control_dt,
            target=self.RunOnce,
            name="go2_rl_infer"
        )
        self._control_thread.Start()

    def Stop(self):
        if self._control_thread is not None:
            self._control_thread.Wait(1.0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("channel", nargs="?", default=None, help="DDS network iface, same usage as examples")
    parser.add_argument("--onnx", default=DEFAULT_ONNX, help="Path to exported policy.onnx")
    parser.add_argument("--deploy", default=DEFAULT_DEPLOY_YAML, help="Path to deploy.yaml (from unitree_rl_lab run)")
    parser.add_argument("--dt", type=float, default=None, help="Control period. default: deploy.yaml step_dt")
    parser.add_argument("--vx", type=float, default=0.0, help="base_velocity.lin_vel_x")
    parser.add_argument("--vy", type=float, default=0.0, help="base_velocity.lin_vel_y")
    parser.add_argument("--wz", type=float, default=0.0, help="base_velocity.ang_vel_z")
    parser.add_argument("--step-x", type=float, default=0.05, help="Increment size for vx on each key press")
    parser.add_argument("--step-y", type=float, default=0.05, help="Increment size for vy on each key press")
    parser.add_argument("--step-z", type=float, default=0.10, help="Increment size for wz on each key press")
    parser.add_argument("--no-keyboard", action="store_true", help="Disable runtime keyboard command input")
    parser.add_argument("--quat-order", choices=("wxyz", "xyzw"), default="wxyz")
    parser.add_argument("--domain", type=int, default=0)
    args = parser.parse_args()

    print("WARNING: Make sure area around the robot is clear and robot is ready.")
    input("Press Enter to continue...")

    if args.channel is None:
        ChannelFactoryInitialize(args.domain)
    else:
        ChannelFactoryInitialize(args.domain, args.channel)

    runner = Go2RlExample(
        onnx_path=args.onnx,
        deploy_cfg_path=args.deploy,
        quat_order=args.quat_order,
        command=(args.vx, args.vy, args.wz),
        control_dt=args.dt,
    )
    publish_hz = 1.0 / runner.control_dt if runner.control_dt > 0 else 0.0
    print(f"[INFO] lowcmd publish interval = {runner.control_dt:.4f}s => {publish_hz:.2f} Hz")
    runner.Start()
    kb = None
    if not args.no_keyboard:
        kb = KeyboardController(runner, step_x=args.step_x, step_y=args.step_y, step_z=args.step_z)
        kb.start()

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        if kb is not None:
            kb.stop()
        runner.Stop()


if __name__ == "__main__":
    main()
```

</details>

### test 1.

-   로봇개에 랜선을 연결하였을때 eno1 네트워크 인터페이스가 잡혔습니다.
-   go2에 /lowcmd를 전달하기 위해서는 기존에 go2내부에서 작동하고 있던 모든 컨트롤 시스템을 shutdown하는 작업이 필수적이였습니다.
    -   이를 위해서 unitree_sdk2_python에 있던 msc 인터페이스를 통해 rl을 명령을 내릴 수 있었습니다.

            self.msc = MotionSwitcherClient()
            self.msc.SetTimeout(5.0)
            self.msc.Init()

        [![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80c7-bb29-c37f639f4d00.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80c7-bb29-c37f639f4d00.gif){.popup .img-link .shimmer}

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-804d-a349-ddca6da9759a.webp)](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-804d-a349-ddca6da9759a.webp){.popup .img-link .shimmer}

-   [1.0, 0.4, -1.0] 과 같은 명령을 주었는데도 go2 로봇이 발을 떼지 않는 문제가 있습니다. 방향에 따라 몸통을 기울이기는 하지만 go2가 실제로 움직이지는 않는 상황입니다. 예상되는 원인은 아래와 같습니다.
    1.  depoly시에 observation으로 주는 값이 train과 같지 않다.
    2.  imu 정보를 읽어오는 부분에서 좌표계가 꼬였다.
    3.  보상중에 발을 땅에서 떼도록 하는 feet_air_time과 feet_slide의 가중치가 잘못 되었다.
