---
title: "[Unitree Go2 part 1] Sim2Real 첫 도전"
date: 2026-03-12 14:28:00 +0900
last_modified_at: 2026-05-25 01:25:08 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, isaac-sim, deployment]
description: Unitree Go2에 강화학습 기반 보행 policy를 실제 deploy하기 위해 baseline을 정하고, 첫 학습과 real deploy를 시도한 과정을 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif
math: true
---

## **1. 프로젝트 목표**

이 프로젝트는 Unitree Go2를 구매한 뒤, 실제 로봇에서 강화학습 기반 보행 policy를 deploy해보는 것을 목표로 시작했습니다. 하지만 최종 목표는 단순히 "걷게 만들기"에서 끝나지 않습니다.

장기적으로 주장하고 싶은 것은 다음과 같습니다.

> 실로봇 장시간 보행에서는 nominal RL policy가 command tracking은 잘해도, 특정 actuator에 열과 부하가 불균일하게 쌓여 thermal bottleneck이 될 수 있다. 따라서 `/lowstate`에서 얻을 수 있는 per-motor temperature, current/load, torque, joint state를 이용해 runtime에서 보행 입력을 조절하는 thermal-aware regulator가 필요하다.

즉 목표는 새로운 보행 policy 하나를 더 만드는 것이 아니라, **기본 보행 policy 위에 per-motor thermal state와 current-derived load를 보는 runtime regulation layer를 얹어, 비슷한 walking task를 유지하면서 peak temperature와 temperature rise를 줄일 수 있는지** 확인하는 것입니다.

이 글은 그 첫 단계로, 이후 실험의 기준선이 될 기본 보행 policy를 학습하고 실제 로봇에 올려보는 과정을 다룹니다. 이 baseline은 나중에 proposed thermal-aware controller가 정말 나아졌는지 비교하기 위한 control group이 됩니다.

## **2. 베이스라인 선택**

가장 먼저 정해야 할 것은 baseline이었습니다. 처음부터 모든 환경과 deploy 코드를 직접 만들기보다는, 이미 real robot deploy까지 고려된 reference를 기준으로 잡는 편이 안전하다고 판단했습니다.

여기서 baseline은 단순한 출발 코드가 아닙니다. 나중에 thermal-aware regulator를 붙였을 때 비교할 nominal policy이기도 합니다. 그래서 baseline은 "걷는 것"뿐 아니라, 같은 command profile에서 motor temperature, torque, current, runtime이 어떻게 나오는지 측정할 수 있어야 합니다.

baseline을 고르는 기준은 아래와 같았습니다.

1. Unitree Go2를 real robot에서 걷게 할 수 있는 RL 보행 모델일 것
2. Isaac Lab 또는 Unitree에서 공개한 환경 설정을 기반으로 할 것
3. 이후 Sim2Real gap을 줄이기 위해 설정을 확장하기 쉬울 것
4. 이후 `/lowstate` 기반 thermal/current logging과 연결하기 쉬울 것

결론적으로 baseline은 Unitree에서 공개한 `unitree_rl_lab`을 따르기로 했습니다.

<https://github.com/unitreerobotics/unitree_rl_lab>

선택한 이유는 세 가지였습니다.

1. Unitree에서 직접 배포한 repository라 사용 설명과 deploy 흐름이 비교적 잘 정리되어 있었습니다.
2. G1 humanoid 예제가 실제 로봇에서 걷는 것을 확인했기 때문에, Go2에서도 같은 방향으로 시작해볼 수 있다고 판단했습니다.
3. Unitree SDK2와의 연동 코드가 포함되어 있어 real deploy까지 이어가기 쉬웠습니다.

## **3. Isaac Sim 학습**

simulation에서 학습하는 과정 자체는 비교적 단순했습니다. 첫 시도였기 때문에 기본 설정을 최대한 유지하고, iteration을 10000으로 두고 학습했습니다.

```bash
python scripts/rsl_rl/train.py --headless --task Unitree-Go2-Velocity --video --video_interval 1000 --num_envs 4096 --seed 42 --max_iterations 10000
```

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif){.popup .img-link .shimmer}

`--video` 옵션을 사용해 학습 중간 결과가 자동으로 저장되도록 했습니다. 영상만 보면 policy가 simulation 안에서는 나쁘지 않게 걷는 것처럼 보였습니다.

## **4. 실제 로봇 Deploy 준비**

원래는 real robot에 올리기 전에 CPU 기반 시뮬레이터인 **MuJoCo**에서 sim-to-sim 테스트를 먼저 해보는 편이 맞습니다. 하지만 첫 학습 결과가 꽤 좋아 보였기 때문에, 이 단계에서는 바로 실제 로봇에 deploy해보기로 했습니다.

### **4.1 Unitree Python SDK 기반 제어**

모델을 deploy하기 위해 `/lowstate` topic에서 `joint_pose`, `joint_vel`, `imu`, pressure sensor, `last_action` 등을 observation으로 구성했습니다. 이후 ONNX 모델로 action을 추론하고, 50 Hz로 `/lowcmd`에 command를 발행하는 구조를 사용했습니다.

- Joint Pos: $q_{rel} = q - \text{default joint pos}$
- Joint Vel: $dq$
- Base angular velocity: $\text{imu (gyroscope)} : [w_x, w_y, w_z]$
- Projected gravity: $g_{body} = R(q)^T \cdot \begin{bmatrix} 0 \ 0 \ -1 \end{bmatrix}$
- Velocity command: keyboard input

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

## **5. 첫 Deploy 결과**

- 로봇에 랜선을 연결하자 `eno1` 네트워크 인터페이스가 잡혔습니다.
- Go2에 `/lowcmd`를 전달하려면, 기존에 내부에서 동작하던 control system을 먼저 shutdown해야 했습니다.
  - 이를 위해 `unitree_sdk2_python`의 `msc` interface를 사용해 RL mode로 전환했습니다.

            self.msc = MotionSwitcherClient()
            self.msc.SetTimeout(5.0)
            self.msc.Init()

        [![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80c7-bb29-c37f639f4d00.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80c7-bb29-c37f639f4d00.gif){.popup .img-link .shimmer}

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-804d-a349-ddca6da9759a.webp)](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-804d-a349-ddca6da9759a.webp){.popup .img-link .shimmer}

`[1.0, 0.4, -1.0]` 같은 command를 주었는데도 Go2는 발을 떼지 못했습니다. command 방향에 따라 base를 기울이기는 했지만, 실제 보행으로 이어지지는 않았습니다.

이 시점에서 예상한 원인은 아래와 같았습니다.

1. deploy에서 구성한 observation이 training 때의 observation과 다를 수 있습니다.
2. IMU 정보를 읽는 과정에서 좌표계가 어긋났을 수 있습니다.
3. `feet_air_time`, `feet_slide`처럼 발을 떼는 동작과 관련된 reward weight가 적절하지 않을 수 있습니다.

첫 시도는 실패였지만, 문제를 좁히기 위한 기준은 생겼습니다. 다음 단계에서는 reward 설정과 sim-to-sim 검증을 중심으로 원인을 확인합니다.
