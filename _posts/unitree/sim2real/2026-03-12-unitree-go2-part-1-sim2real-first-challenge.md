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

{% raw %}
<h1 id="what-is-this-project">What is this project</h1><p>이 프로젝트는 Unitree Go2의 로봇개를 구매한후 25년 12월 부터 구상하기 시작해서 현재까지 이르게 되었다.</p><p>이 프로젝트에 대해서 간단하게 설명 하자면 go2 로봇의 /lowstate에 로봇 각 모터의 현재 온도와 토크 같은 정보가 들어 있는데 이를 활용하여 <strong>보행시에 온도를 높이지 않고 부담이 많이가는 모터를 인지</strong>하여 스스로 <strong>건강을 관리하는 “강화학습” 모델</strong>을 만든는 것이다!</p><h2 id="what-is-plan"><span class="me-2">What is Plan</span><a href="#what-is-plan" class="anchor text-muted"><i class="fas fa-hashtag"></i></a></h2><p>계획을 세웠다면 이를 이루기 위한 계획이 필요하다. 첫번째로는 Baseline을 정하는 것이다.</p><p>베이스라인의 기준은 아래와 같았다.</p><ol><li>Unitree Go2 모델을 Real에서 걷게 할 수 있는 RL 보행 모델일 것.<ol><li>나중에 sim2real gap을 매꾸기가 어려울 것을 알고 있었기 때문에 나중에 이것저것 설정을 추가할 것을 고려해서 가장 basic한 reference를 찾았다.</ol><li>Isaaclab이나 Unitree에서 배포한 env 환경설정을 따를 것.</ol><p>결론적으로 Baseline으로 unitree 사에서 내놓은 Unitree_rl_lab을 따르기로 했다.</p><p><a href="https://github.com/unitreerobotics/unitree_rl_lab">https://github.com/unitreerobotics/unitree_rl_lab</a></p><ol><li>Unitree 사에서 직접 배포한 repo인 만큼 사용 설명이 잘 정리되어 있었고 많은 사람이 시도해 보았기 때문에 잔 버그가 없을 것 같았다.<li>g1 휴머노이드 모델이 real에서 잘 걷는 것을 보고 이 정책대로만 학습하면 go2도 잘 걸을 수 있을 것이라 생각하였다.<li>무엇보다 unitree sdk2와 연동이 잘 되어있어 재현하기가 쉬울 것 같았다.</ol><h1 id="isaacsim-train">IsaacSim train</h1><p>simulation 상에서 train 하는 것 자체는 매우 쉬웠다. 일단 처음 학습해보는 것인 만큼 기본 설정대로 iteration을 10000번만큼 학습하였다.</p><div class="language-bash highlighter-rouge"><div class="code-header"> <span data-label-text="Shell"><i class="fas fa-code fa-fw small"></i></span> <button aria-label="copy" data-title-succeed="복사되었습니다!"><i class="far fa-clipboard"></i></button></div><div class="highlight"><code><table class="rouge-table"><tbody><tr><td class="rouge-gutter gl"><pre class="lineno">1
</pre><td class="rouge-code"><pre>python scripts/rsl_rl/train.py <span class="nt">--headless</span> <span class="nt">--task</span> Unitree-Go2-Velocity <span class="nt">--video</span> <span class="nt">--video_interval</span> 1000 <span class="nt">--num_envs</span> 4096 <span class="nt">--seed</span> 42 <span class="nt">--max_iterations</span> 10000
</pre></table></code></div></div><p><a href="/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif" class="popup img-link shimmer"><img src="/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80b5-bdf0-f4eb03b0e2ff.gif" alt="" loading="lazy"></a></p><ul><li>— video 옵션을 주어 학습중에 자동으로 비디오가 저장되게 하였고 영상 속에서는 학습 결과가 나쁘지 않은 것처럼 보였다!</ul><h2 id="trained-model-depoly"><span class="me-2">trained model depoly</span><a href="#trained-model-depoly" class="anchor text-muted"><i class="fas fa-hashtag"></i></a></h2><p>원래는 sim2sim으로 cpu기반 시뮬레이터인 <strong>mujoco</strong>에서 테스트를 해보아야 했지만 train 결과가 너무 좋아보였기 때문에 바로 실제 로봇에 deploy 해보기로 결정했다.</p><h3 id="unitree-python-sdk"><span class="me-2">unitree python sdk</span><a href="#unitree-python-sdk" class="anchor text-muted"><i class="fas fa-hashtag"></i></a></h3><p>모델을 depoly 하기 위해 /lowstate 토픽에서 joint_pose, joint_vel, imu, 압력센서, last_action등을 observation으로 하고 이를 onnx 모델에서 추론하여 50hz로 action을 /lowcmd 로 발행하였습니다.</p><ul><li>Joint Pos : $q_{rel} = q - \text{default joint pos}$<li>joint Vel : $dq$<li>base_ang_vel : $\text{imu (gyroscope)} : [w_x, w_y, w_z]$<li>Projected gravity : $g_{body} = R(q)^T \cdot \begin{bmatrix} 0 \ 0 \ -1 \end{bmatrix}$<li>velocity command : keyboard input</ul><details> <summary>code base</summary><div class="language-python highlighter-rouge"><div class="code-header"> <span data-label-text="Python"><i class="fas fa-code fa-fw small"></i></span> <button aria-label="copy" data-title-succeed="복사되었습니다!"><i class="far fa-clipboard"></i></button></div><div class="highlight"><code><table class="rouge-table"><tbody><tr><td class="rouge-gutter gl"><pre class="lineno">1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
97
98
99
100
101
102
103
104
105
106
107
108
109
110
111
112
113
114
115
116
117
118
119
120
121
122
123
124
125
126
127
128
129
130
131
132
133
134
135
136
137
138
139
140
141
142
143
144
145
146
147
148
149
150
151
152
153
154
155
156
157
158
159
160
161
162
163
164
165
166
167
168
169
170
171
172
173
174
175
176
177
178
179
180
181
182
183
184
185
186
187
188
189
190
191
192
193
194
195
196
197
198
199
200
201
202
203
204
205
206
207
208
209
210
211
212
213
214
215
216
217
218
219
220
221
222
223
224
225
226
227
228
229
230
231
232
233
234
235
236
237
238
239
240
241
242
243
244
245
246
247
248
249
250
251
252
253
254
255
256
257
258
259
260
261
262
263
264
265
266
267
268
269
270
271
272
273
274
275
276
277
278
279
280
281
282
283
284
285
286
287
288
289
290
291
292
293
294
295
296
297
298
299
300
301
302
303
304
305
306
307
308
309
310
311
312
313
314
315
316
317
318
319
320
321
322
323
324
325
326
327
328
329
330
331
332
333
334
335
336
337
338
339
340
341
342
343
344
345
346
347
348
349
350
351
352
353
354
355
356
357
358
359
360
361
362
363
364
365
366
367
368
369
370
371
372
373
374
375
376
377
378
379
380
381
382
383
384
385
386
387
388
389
390
391
392
393
394
395
396
397
398
399
400
401
402
403
404
405
406
407
408
409
410
411
412
413
414
415
416
417
418
419
420
421
422
423
424
425
426
427
428
429
430
431
432
433
434
435
436
437
438
439
440
441
442
443
444
445
446
447
448
449
450
451
452
453
454
455
456
457
458
459
460
461
462
463
464
465
466
467
468
469
470
471
472
473
474
475
476
477
478
479
480
481
482
483
484
485
486
487
488
489
490
491
492
493
494
495
496
497
498
499
500
501
502
503
504
505
506
507
508
509
510
511
512
513
514
515
516
517
518
519
520
521
522
523
524
525
526
527
528
529
</pre><td class="rouge-code"><pre><span class="kn">import</span> <span class="n">argparse</span>
<span class="kn">import</span> <span class="n">math</span>
<span class="kn">import</span> <span class="n">threading</span>
<span class="kn">import</span> <span class="n">time</span>
<span class="kn">import</span> <span class="n">sys</span>
<span class="kn">import</span> <span class="n">select</span>
<span class="kn">from</span> <span class="n">typing</span> <span class="kn">import</span> <span class="n">Callable</span><span class="p">,</span> <span class="n">Dict</span><span class="p">,</span> <span class="n">List</span>

<span class="kn">import</span> <span class="n">numpy</span> <span class="k">as</span> <span class="n">np</span>
<span class="kn">import</span> <span class="n">yaml</span>

<span class="kn">from</span> <span class="n">unitree_sdk2py.core.channel</span> <span class="kn">import</span> <span class="n">ChannelFactoryInitialize</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.core.channel</span> <span class="kn">import</span> <span class="n">ChannelPublisher</span><span class="p">,</span> <span class="n">ChannelSubscriber</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.idl.default</span> <span class="kn">import</span> <span class="n">unitree_go_msg_dds__LowCmd_</span><span class="p">,</span> <span class="n">unitree_go_msg_dds__LowState_</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.idl.unitree_go.msg.dds_</span> <span class="kn">import</span> <span class="n">LowCmd_</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.idl.unitree_go.msg.dds_</span> <span class="kn">import</span> <span class="n">LowState_</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.utils.crc</span> <span class="kn">import</span> <span class="n">CRC</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.utils.thread</span> <span class="kn">import</span> <span class="n">RecurrentThread</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.comm.motion_switcher.motion_switcher_client</span> <span class="kn">import</span> <span class="n">MotionSwitcherClient</span>
<span class="kn">from</span> <span class="n">unitree_sdk2py.go2.sport.sport_client</span> <span class="kn">import</span> <span class="n">SportClient</span>
<span class="kn">import</span> <span class="n">unitree_legged_const</span> <span class="k">as</span> <span class="n">go2</span>

<span class="k">try</span><span class="p">:</span>
    <span class="kn">import</span> <span class="n">onnxruntime</span> <span class="k">as</span> <span class="n">ort</span>
<span class="k">except</span> <span class="nb">ModuleNotFoundError</span> <span class="k">as</span> <span class="n">exc</span><span class="p">:</span>
    <span class="k">raise</span> <span class="nc">RuntimeError</span><span class="p">(</span>
        <span class="sh">"</span><span class="s">onnxruntime is required. install with: python -m pip install onnxruntime</span><span class="sh">"</span>
    <span class="p">)</span> <span class="k">from</span> <span class="n">exc</span>

<span class="k">try</span><span class="p">:</span>
    <span class="kn">import</span> <span class="n">termios</span>
    <span class="kn">import</span> <span class="n">tty</span>
<span class="k">except</span> <span class="nb">ImportError</span><span class="p">:</span>  <span class="c1"># pragma: no cover - non-posix fallback
</span>    <span class="n">termios</span> <span class="o">=</span> <span class="bp">None</span>
    <span class="n">tty</span> <span class="o">=</span> <span class="bp">None</span>


<span class="n">DEFAULT_DEPLOY_YAML</span> <span class="o">=</span> <span class="sh">"</span><span class="s">/home/loe/workspace/github/unitree_rl_lab/logs/rsl_rl/unitree_go2_velocity/2026-03-10_00-08-13/params/deploy.yaml</span><span class="sh">"</span>
<span class="n">DEFAULT_ONNX</span> <span class="o">=</span> <span class="sh">"</span><span class="s">/home/loe/workspace/github/unitree_rl_lab/logs/rsl_rl/unitree_go2_velocity/2026-03-10_00-08-13/exported/policy.onnx</span><span class="sh">"</span>


<span class="k">def</span> <span class="nf">_ensure_float_array</span><span class="p">(</span><span class="n">value</span><span class="p">,</span> <span class="n">size</span><span class="p">:</span> <span class="nb">int</span> <span class="o">|</span> <span class="bp">None</span> <span class="o">=</span> <span class="bp">None</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">:</span>
    <span class="k">if</span> <span class="nf">isinstance</span><span class="p">(</span><span class="n">value</span><span class="p">,</span> <span class="p">(</span><span class="nb">int</span><span class="p">,</span> <span class="nb">float</span><span class="p">)):</span>
        <span class="n">arr</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">([</span><span class="n">value</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
    <span class="k">else</span><span class="p">:</span>
        <span class="n">arr</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">(</span><span class="n">value</span><span class="p">,</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
    <span class="k">if</span> <span class="n">arr</span><span class="p">.</span><span class="n">ndim</span> <span class="o">!=</span> <span class="mi">1</span><span class="p">:</span>
        <span class="n">arr</span> <span class="o">=</span> <span class="n">arr</span><span class="p">.</span><span class="nf">reshape</span><span class="p">(</span><span class="o">-</span><span class="mi">1</span><span class="p">)</span>
    <span class="k">if</span> <span class="n">size</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span><span class="p">:</span>
        <span class="k">if</span> <span class="n">arr</span><span class="p">.</span><span class="n">size</span> <span class="o">==</span> <span class="mi">1</span> <span class="ow">and</span> <span class="n">size</span> <span class="o">&gt;</span> <span class="mi">1</span><span class="p">:</span>
            <span class="n">arr</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">full</span><span class="p">(</span><span class="n">size</span><span class="p">,</span> <span class="nf">float</span><span class="p">(</span><span class="n">arr</span><span class="p">[</span><span class="mi">0</span><span class="p">]),</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
        <span class="k">elif</span> <span class="n">arr</span><span class="p">.</span><span class="n">size</span> <span class="o">!=</span> <span class="n">size</span><span class="p">:</span>
            <span class="k">raise</span> <span class="nc">ValueError</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="s">expected size=</span><span class="si">{</span><span class="n">size</span><span class="si">}</span><span class="s">, got=</span><span class="si">{</span><span class="n">arr</span><span class="p">.</span><span class="n">size</span><span class="si">}</span><span class="sh">"</span><span class="p">)</span>
    <span class="k">return</span> <span class="n">arr</span>


<span class="k">def</span> <span class="nf">_scale_and_clip</span><span class="p">(</span><span class="n">values</span><span class="p">:</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">,</span> <span class="n">scale</span><span class="p">:</span> <span class="nb">float</span> <span class="o">|</span> <span class="nb">list</span><span class="p">[</span><span class="nb">float</span><span class="p">],</span> <span class="n">clip</span><span class="p">:</span> <span class="nb">list</span><span class="p">[</span><span class="nb">float</span><span class="p">]</span> <span class="o">|</span> <span class="nb">tuple</span><span class="p">[</span><span class="nb">float</span><span class="p">,</span> <span class="nb">float</span><span class="p">]</span> <span class="o">|</span> <span class="bp">None</span><span class="p">):</span>
    <span class="k">if</span> <span class="nf">isinstance</span><span class="p">(</span><span class="n">scale</span><span class="p">,</span> <span class="p">(</span><span class="nb">int</span><span class="p">,</span> <span class="nb">float</span><span class="p">)):</span>
        <span class="n">values</span> <span class="o">=</span> <span class="n">values</span> <span class="o">*</span> <span class="nf">float</span><span class="p">(</span><span class="n">scale</span><span class="p">)</span>
    <span class="k">else</span><span class="p">:</span>
        <span class="n">s</span> <span class="o">=</span> <span class="nf">_ensure_float_array</span><span class="p">(</span><span class="n">scale</span><span class="p">,</span> <span class="n">values</span><span class="p">.</span><span class="n">size</span><span class="p">)</span>
        <span class="n">values</span> <span class="o">=</span> <span class="n">values</span> <span class="o">*</span> <span class="n">s</span>

    <span class="k">if</span> <span class="n">clip</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span><span class="p">:</span>
        <span class="n">lo</span><span class="p">,</span> <span class="n">hi</span> <span class="o">=</span> <span class="n">clip</span>
        <span class="n">values</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">clip</span><span class="p">(</span><span class="n">values</span><span class="p">,</span> <span class="nf">float</span><span class="p">(</span><span class="n">lo</span><span class="p">),</span> <span class="nf">float</span><span class="p">(</span><span class="n">hi</span><span class="p">))</span>
    <span class="k">return</span> <span class="n">values</span>


<span class="c1"># def _quat_to_gravity_body(q: List[float], order: str) -&gt; np.ndarray:
#     # q is assumed unit-length quaternion
#     if q is None or len(q) &lt; 4:
#         return np.array([0.0, 0.0, -1.0], dtype=np.float32)
</span>
<span class="c1">#     if order == "wxyz":
#         w, x, y, z = [float(v) for v in q[:4]]
#     else:
#         x, y, z, w = [float(v) for v in q[:4]]
</span>
<span class="c1">#     n2 = w * w + x * x + y * y + z * z
#     if n2 &lt; 1e-8:
#         return np.array([0.0, 0.0, -1.0], dtype=np.float32)
#     inv_n = 1.0 / math.sqrt(n2)
#     w, x, y, z = w * inv_n, x * inv_n, y * inv_n, z * inv_n
</span>
<span class="c1">#     # base(=body) to world rotation matrix from quaternion.
#     # projected gravity in body frame = R^T @ [0,0,-1]
#     # this becomes [-R02, -R12, -R22]
#     r02 = 2.0 * (x * z + y * w)
#     r12 = 2.0 * (y * z - x * w)
#     r22 = 1.0 - 2.0 * (x * x + y * y)
#     return np.array([-r02, -r12, -r22], dtype=np.float32)
</span>
<span class="k">def</span> <span class="nf">_quat_to_gravity_body</span><span class="p">(</span><span class="n">q</span><span class="p">,</span> <span class="n">order</span><span class="p">:</span> <span class="nb">str</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">:</span>
    <span class="k">if</span> <span class="n">q</span> <span class="ow">is</span> <span class="bp">None</span> <span class="ow">or</span> <span class="nf">len</span><span class="p">(</span><span class="n">q</span><span class="p">)</span> <span class="o">&lt;</span> <span class="mi">4</span><span class="p">:</span>
        <span class="k">return</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">([</span><span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="o">-</span><span class="mf">1.0</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>

    <span class="k">if</span> <span class="n">order</span> <span class="o">==</span> <span class="sh">"</span><span class="s">wxyz</span><span class="sh">"</span><span class="p">:</span>
        <span class="n">w</span><span class="p">,</span> <span class="n">x</span><span class="p">,</span> <span class="n">y</span><span class="p">,</span> <span class="n">z</span> <span class="o">=</span> <span class="p">[</span><span class="nf">float</span><span class="p">(</span><span class="n">v</span><span class="p">)</span> <span class="k">for</span> <span class="n">v</span> <span class="ow">in</span> <span class="n">q</span><span class="p">[:</span><span class="mi">4</span><span class="p">]]</span>
    <span class="k">else</span><span class="p">:</span>
        <span class="n">x</span><span class="p">,</span> <span class="n">y</span><span class="p">,</span> <span class="n">z</span><span class="p">,</span> <span class="n">w</span> <span class="o">=</span> <span class="p">[</span><span class="nf">float</span><span class="p">(</span><span class="n">v</span><span class="p">)</span> <span class="k">for</span> <span class="n">v</span> <span class="ow">in</span> <span class="n">q</span><span class="p">[:</span><span class="mi">4</span><span class="p">]]</span>

    <span class="n">n2</span> <span class="o">=</span> <span class="n">w</span> <span class="o">*</span> <span class="n">w</span> <span class="o">+</span> <span class="n">x</span> <span class="o">*</span> <span class="n">x</span> <span class="o">+</span> <span class="n">y</span> <span class="o">*</span> <span class="n">y</span> <span class="o">+</span> <span class="n">z</span> <span class="o">*</span> <span class="n">z</span>
    <span class="k">if</span> <span class="n">n2</span> <span class="o">&lt;</span> <span class="mf">1e-8</span><span class="p">:</span>
        <span class="k">return</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">([</span><span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="o">-</span><span class="mf">1.0</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>

    <span class="n">inv_n</span> <span class="o">=</span> <span class="mf">1.0</span> <span class="o">/</span> <span class="n">math</span><span class="p">.</span><span class="nf">sqrt</span><span class="p">(</span><span class="n">n2</span><span class="p">)</span>
    <span class="n">w</span><span class="p">,</span> <span class="n">x</span><span class="p">,</span> <span class="n">y</span><span class="p">,</span> <span class="n">z</span> <span class="o">=</span> <span class="n">w</span> <span class="o">*</span> <span class="n">inv_n</span><span class="p">,</span> <span class="n">x</span> <span class="o">*</span> <span class="n">inv_n</span><span class="p">,</span> <span class="n">y</span> <span class="o">*</span> <span class="n">inv_n</span><span class="p">,</span> <span class="n">z</span> <span class="o">*</span> <span class="n">inv_n</span>

    <span class="c1"># correct: R^T @ [0,0,-1] = [-R20, -R21, -R22]
</span>    <span class="n">gx</span> <span class="o">=</span> <span class="mf">2.0</span> <span class="o">*</span> <span class="p">(</span><span class="n">x</span> <span class="o">*</span> <span class="n">z</span> <span class="o">-</span> <span class="n">y</span> <span class="o">*</span> <span class="n">w</span><span class="p">)</span>
    <span class="n">gy</span> <span class="o">=</span> <span class="mf">2.0</span> <span class="o">*</span> <span class="p">(</span><span class="n">y</span> <span class="o">*</span> <span class="n">z</span> <span class="o">+</span> <span class="n">x</span> <span class="o">*</span> <span class="n">w</span><span class="p">)</span>
    <span class="n">gz</span> <span class="o">=</span> <span class="mf">1.0</span> <span class="o">-</span> <span class="mf">2.0</span> <span class="o">*</span> <span class="p">(</span><span class="n">x</span> <span class="o">*</span> <span class="n">x</span> <span class="o">+</span> <span class="n">y</span> <span class="o">*</span> <span class="n">y</span><span class="p">)</span>

    <span class="k">return</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">([</span><span class="o">-</span><span class="n">gx</span><span class="p">,</span> <span class="o">-</span><span class="n">gy</span><span class="p">,</span> <span class="o">-</span><span class="n">gz</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>

<span class="k">class</span> <span class="nc">KeyboardController</span><span class="p">:</span>
    <span class="k">def</span> <span class="nf">__init__</span><span class="p">(</span>
        <span class="n">self</span><span class="p">,</span>
        <span class="n">example</span><span class="p">:</span> <span class="sh">"</span><span class="s">Go2RlExample</span><span class="sh">"</span><span class="p">,</span>
        <span class="n">step_x</span><span class="p">:</span> <span class="nb">float</span> <span class="o">=</span> <span class="mf">0.05</span><span class="p">,</span>
        <span class="n">step_y</span><span class="p">:</span> <span class="nb">float</span> <span class="o">=</span> <span class="mf">0.05</span><span class="p">,</span>
        <span class="n">step_z</span><span class="p">:</span> <span class="nb">float</span> <span class="o">=</span> <span class="mf">0.10</span><span class="p">,</span>
    <span class="p">):</span>
        <span class="n">self</span><span class="p">.</span><span class="n">example</span> <span class="o">=</span> <span class="n">example</span>
        <span class="n">self</span><span class="p">.</span><span class="n">step_x</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">step_x</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">step_y</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">step_y</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">step_z</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">step_z</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_thread</span><span class="p">:</span> <span class="n">threading</span><span class="p">.</span><span class="n">Thread</span> <span class="o">|</span> <span class="bp">None</span> <span class="o">=</span> <span class="bp">None</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_running</span> <span class="o">=</span> <span class="bp">False</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_old_tty_settings</span> <span class="o">=</span> <span class="bp">None</span>

    <span class="k">def</span> <span class="nf">start</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="k">if</span> <span class="n">sys</span><span class="p">.</span><span class="n">stdin</span> <span class="ow">is</span> <span class="bp">None</span> <span class="ow">or</span> <span class="ow">not</span> <span class="n">sys</span><span class="p">.</span><span class="n">stdin</span><span class="p">.</span><span class="nf">isatty</span><span class="p">():</span>
            <span class="nf">print</span><span class="p">(</span><span class="sh">"</span><span class="s">[WARN] stdin is not a tty; keyboard control is disabled.</span><span class="sh">"</span><span class="p">)</span>
            <span class="k">return</span>
        <span class="k">if</span> <span class="n">termios</span> <span class="ow">is</span> <span class="bp">None</span> <span class="ow">or</span> <span class="n">tty</span> <span class="ow">is</span> <span class="bp">None</span><span class="p">:</span>
            <span class="nf">print</span><span class="p">(</span><span class="sh">"</span><span class="s">[WARN] termios/tty is not available; keyboard control is disabled.</span><span class="sh">"</span><span class="p">)</span>
            <span class="k">return</span>

        <span class="n">self</span><span class="p">.</span><span class="n">_running</span> <span class="o">=</span> <span class="bp">True</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_thread</span> <span class="o">=</span> <span class="n">threading</span><span class="p">.</span><span class="nc">Thread</span><span class="p">(</span><span class="n">target</span><span class="o">=</span><span class="n">self</span><span class="p">.</span><span class="n">_run</span><span class="p">,</span> <span class="n">daemon</span><span class="o">=</span><span class="bp">True</span><span class="p">,</span> <span class="n">name</span><span class="o">=</span><span class="sh">"</span><span class="s">go2_keyboard</span><span class="sh">"</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_thread</span><span class="p">.</span><span class="nf">start</span><span class="p">()</span>
        <span class="nf">print</span><span class="p">(</span><span class="sh">"</span><span class="s">[INFO] Keyboard control enabled: w/s=+/- vx, a/d=+/- vy, q/e=+/- wz, space=reset</span><span class="sh">"</span><span class="p">)</span>

    <span class="k">def</span> <span class="nf">stop</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_running</span> <span class="o">=</span> <span class="bp">False</span>
        <span class="k">if</span> <span class="n">self</span><span class="p">.</span><span class="n">_thread</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span> <span class="ow">and</span> <span class="n">self</span><span class="p">.</span><span class="n">_thread</span><span class="p">.</span><span class="nf">is_alive</span><span class="p">():</span>
            <span class="n">self</span><span class="p">.</span><span class="n">_thread</span><span class="p">.</span><span class="nf">join</span><span class="p">(</span><span class="n">timeout</span><span class="o">=</span><span class="mf">1.0</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="nf">_restore_terminal</span><span class="p">()</span>

    <span class="k">def</span> <span class="nf">_restore_terminal</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="k">if</span> <span class="n">self</span><span class="p">.</span><span class="n">_old_tty_settings</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span> <span class="ow">and</span> <span class="n">sys</span><span class="p">.</span><span class="n">stdin</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span> <span class="ow">and</span> <span class="n">termios</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span><span class="p">:</span>
            <span class="k">try</span><span class="p">:</span>
                <span class="n">fd</span> <span class="o">=</span> <span class="n">sys</span><span class="p">.</span><span class="n">stdin</span><span class="p">.</span><span class="nf">fileno</span><span class="p">()</span>
                <span class="n">termios</span><span class="p">.</span><span class="nf">tcsetattr</span><span class="p">(</span><span class="n">fd</span><span class="p">,</span> <span class="n">termios</span><span class="p">.</span><span class="n">TCSADRAIN</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">_old_tty_settings</span><span class="p">)</span>
            <span class="k">except</span> <span class="nb">Exception</span><span class="p">:</span>
                <span class="k">pass</span>
            <span class="n">self</span><span class="p">.</span><span class="n">_old_tty_settings</span> <span class="o">=</span> <span class="bp">None</span>

    <span class="k">def</span> <span class="nf">_run</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">fd</span> <span class="o">=</span> <span class="n">sys</span><span class="p">.</span><span class="n">stdin</span><span class="p">.</span><span class="nf">fileno</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_old_tty_settings</span> <span class="o">=</span> <span class="n">termios</span><span class="p">.</span><span class="nf">tcgetattr</span><span class="p">(</span><span class="n">fd</span><span class="p">)</span>
        <span class="n">tty</span><span class="p">.</span><span class="nf">setcbreak</span><span class="p">(</span><span class="n">fd</span><span class="p">)</span>
        <span class="k">try</span><span class="p">:</span>
            <span class="k">while</span> <span class="n">self</span><span class="p">.</span><span class="n">_running</span><span class="p">:</span>
                <span class="n">readable</span><span class="p">,</span> <span class="n">_</span><span class="p">,</span> <span class="n">_</span> <span class="o">=</span> <span class="n">select</span><span class="p">.</span><span class="nf">select</span><span class="p">([</span><span class="n">sys</span><span class="p">.</span><span class="n">stdin</span><span class="p">],</span> <span class="p">[],</span> <span class="p">[],</span> <span class="mf">0.05</span><span class="p">)</span>
                <span class="k">if</span> <span class="ow">not</span> <span class="n">readable</span><span class="p">:</span>
                    <span class="k">continue</span>

                <span class="n">ch</span> <span class="o">=</span> <span class="n">sys</span><span class="p">.</span><span class="n">stdin</span><span class="p">.</span><span class="nf">read</span><span class="p">(</span><span class="mi">1</span><span class="p">).</span><span class="nf">lower</span><span class="p">()</span>
                <span class="k">if</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="s">w</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">update_command_delta</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">step_x</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">)</span>
                <span class="k">elif</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="s">s</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">update_command_delta</span><span class="p">(</span><span class="o">-</span><span class="n">self</span><span class="p">.</span><span class="n">step_x</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">)</span>
                <span class="k">elif</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="s">a</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">update_command_delta</span><span class="p">(</span><span class="mf">0.0</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">step_y</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">)</span>
                <span class="k">elif</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="s">d</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">update_command_delta</span><span class="p">(</span><span class="mf">0.0</span><span class="p">,</span> <span class="o">-</span><span class="n">self</span><span class="p">.</span><span class="n">step_y</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">)</span>
                <span class="k">elif</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="s">q</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">update_command_delta</span><span class="p">(</span><span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">step_z</span><span class="p">)</span>
                <span class="k">elif</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="s">e</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">update_command_delta</span><span class="p">(</span><span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="o">-</span><span class="n">self</span><span class="p">.</span><span class="n">step_z</span><span class="p">)</span>
                <span class="k">elif</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="s"> </span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">set_command</span><span class="p">(</span><span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">)</span>
                <span class="k">elif</span> <span class="n">ch</span> <span class="o">==</span> <span class="sh">"</span><span class="se">\x03</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">_running</span> <span class="o">=</span> <span class="bp">False</span>
                <span class="n">self</span><span class="p">.</span><span class="nf">_print_command</span><span class="p">()</span>
        <span class="k">finally</span><span class="p">:</span>
            <span class="n">self</span><span class="p">.</span><span class="nf">_restore_terminal</span><span class="p">()</span>

    <span class="k">def</span> <span class="nf">_print_command</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">cmd</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">example</span><span class="p">.</span><span class="nf">get_command</span><span class="p">()</span>
        <span class="nf">print</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="se">\r</span><span class="s">command -&gt; vx:</span><span class="si">{</span><span class="n">cmd</span><span class="p">[</span><span class="mi">0</span><span class="p">]</span><span class="si">:</span><span class="o">+</span><span class="p">.</span><span class="mi">2</span><span class="n">f</span><span class="si">}</span><span class="s">, vy:</span><span class="si">{</span><span class="n">cmd</span><span class="p">[</span><span class="mi">1</span><span class="p">]</span><span class="si">:</span><span class="o">+</span><span class="p">.</span><span class="mi">2</span><span class="n">f</span><span class="si">}</span><span class="s">, wz:</span><span class="si">{</span><span class="n">cmd</span><span class="p">[</span><span class="mi">2</span><span class="p">]</span><span class="si">:</span><span class="o">+</span><span class="p">.</span><span class="mi">2</span><span class="n">f</span><span class="si">}</span><span class="sh">"</span><span class="p">,</span> <span class="n">end</span><span class="o">=</span><span class="sh">""</span><span class="p">,</span> <span class="n">flush</span><span class="o">=</span><span class="bp">True</span><span class="p">)</span>


<span class="k">class</span> <span class="nc">Go2RlExample</span><span class="p">:</span>
    <span class="k">def</span> <span class="nf">__init__</span><span class="p">(</span>
        <span class="n">self</span><span class="p">,</span>
        <span class="n">onnx_path</span><span class="p">:</span> <span class="nb">str</span><span class="p">,</span>
        <span class="n">deploy_cfg_path</span><span class="p">:</span> <span class="nb">str</span><span class="p">,</span>
        <span class="n">quat_order</span><span class="p">:</span> <span class="nb">str</span> <span class="o">=</span> <span class="sh">"</span><span class="s">wxyz</span><span class="sh">"</span><span class="p">,</span>
        <span class="n">command</span><span class="p">:</span> <span class="nb">tuple</span><span class="p">[</span><span class="nb">float</span><span class="p">,</span> <span class="nb">float</span><span class="p">,</span> <span class="nb">float</span><span class="p">]</span> <span class="o">=</span> <span class="p">(</span><span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">),</span>
        <span class="n">control_dt</span><span class="p">:</span> <span class="nb">float</span> <span class="o">|</span> <span class="bp">None</span> <span class="o">=</span> <span class="bp">None</span><span class="p">,</span>
    <span class="p">):</span>
        <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_x</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_y</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_ang</span> <span class="o">=</span> <span class="n">command</span>
        <span class="n">self</span><span class="p">.</span><span class="n">quat_order</span> <span class="o">=</span> <span class="n">quat_order</span>

        <span class="n">self</span><span class="p">.</span><span class="n">low_state</span><span class="p">:</span> <span class="n">LowState_</span> <span class="o">|</span> <span class="bp">None</span> <span class="o">=</span> <span class="bp">None</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_state_lock</span> <span class="o">=</span> <span class="n">threading</span><span class="p">.</span><span class="nc">Lock</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_command_lock</span> <span class="o">=</span> <span class="n">threading</span><span class="p">.</span><span class="nc">Lock</span><span class="p">()</span>

        <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span> <span class="o">=</span> <span class="nf">unitree_go_msg_dds__LowCmd_</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="n">crc</span> <span class="o">=</span> <span class="nc">CRC</span><span class="p">()</span>

        <span class="n">self</span><span class="p">.</span><span class="n">cfg</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="nf">_load_yaml</span><span class="p">(</span><span class="n">deploy_cfg_path</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">[</span><span class="sh">"</span><span class="s">joint_ids_map</span><span class="sh">"</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">int32</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">stiffness</span> <span class="o">=</span> <span class="nf">_ensure_float_array</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">stiffness</span><span class="sh">"</span><span class="p">,</span> <span class="n">np</span><span class="p">.</span><span class="nf">ones</span><span class="p">(</span><span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))),</span> <span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))</span>
        <span class="n">self</span><span class="p">.</span><span class="n">damping</span> <span class="o">=</span> <span class="nf">_ensure_float_array</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">damping</span><span class="sh">"</span><span class="p">,</span> <span class="n">np</span><span class="p">.</span><span class="nf">ones</span><span class="p">(</span><span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))),</span> <span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))</span>
        <span class="n">self</span><span class="p">.</span><span class="n">default_joint_pos</span> <span class="o">=</span> <span class="nf">_ensure_float_array</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">default_joint_pos</span><span class="sh">"</span><span class="p">,</span> <span class="n">np</span><span class="p">.</span><span class="nf">zeros</span><span class="p">(</span><span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))),</span> <span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))</span>

        <span class="n">self</span><span class="p">.</span><span class="n">actions_cfg</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">[</span><span class="sh">"</span><span class="s">actions</span><span class="sh">"</span><span class="p">][</span><span class="sh">"</span><span class="s">JointPositionAction</span><span class="sh">"</span><span class="p">]</span>
        <span class="n">self</span><span class="p">.</span><span class="n">action_clip</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">actions_cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">clip</span><span class="sh">"</span><span class="p">,</span> <span class="p">[</span><span class="o">-</span><span class="mf">100.0</span><span class="p">,</span> <span class="mf">100.0</span><span class="p">])</span>
        <span class="n">self</span><span class="p">.</span><span class="n">action_scale</span> <span class="o">=</span> <span class="nf">_ensure_float_array</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">actions_cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">scale</span><span class="sh">"</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">),</span> <span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))</span>
        <span class="n">self</span><span class="p">.</span><span class="n">action_offset</span> <span class="o">=</span> <span class="nf">_ensure_float_array</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">actions_cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">offset</span><span class="sh">"</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">),</span> <span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">))</span>
        <span class="n">self</span><span class="p">.</span><span class="n">action_dim</span> <span class="o">=</span> <span class="nf">len</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">)</span>

        <span class="n">self</span><span class="p">.</span><span class="n">obs_cfg</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">[</span><span class="sh">"</span><span class="s">observations</span><span class="sh">"</span><span class="p">]</span>
        <span class="n">self</span><span class="p">.</span><span class="n">obs_term_builders</span><span class="p">:</span> <span class="nb">list</span><span class="p">[</span><span class="nb">tuple</span><span class="p">[</span><span class="nb">str</span><span class="p">,</span> <span class="n">Dict</span><span class="p">]]</span> <span class="o">=</span> <span class="p">[]</span>
        <span class="k">for</span> <span class="n">name</span><span class="p">,</span> <span class="n">term</span> <span class="ow">in</span> <span class="n">self</span><span class="p">.</span><span class="n">obs_cfg</span><span class="p">.</span><span class="nf">items</span><span class="p">():</span>
            <span class="k">if</span> <span class="n">term</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">history_length</span><span class="sh">"</span><span class="p">,</span> <span class="mi">1</span><span class="p">)</span> <span class="o">!=</span> <span class="mi">1</span><span class="p">:</span>
                <span class="c1"># current sample does not keep history buffer
</span>                <span class="k">pass</span>
            <span class="n">self</span><span class="p">.</span><span class="n">obs_term_builders</span><span class="p">.</span><span class="nf">append</span><span class="p">((</span><span class="n">name</span><span class="p">,</span> <span class="n">term</span><span class="p">))</span>

        <span class="n">command_cfg</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">commands</span><span class="sh">"</span><span class="p">,</span> <span class="p">{}).</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">base_velocity</span><span class="sh">"</span><span class="p">,</span> <span class="p">{})</span>
        <span class="n">self</span><span class="p">.</span><span class="n">command_limits</span> <span class="o">=</span> <span class="n">command_cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">ranges</span><span class="sh">"</span><span class="p">,</span> <span class="p">{</span><span class="sh">"</span><span class="s">lin_vel_x</span><span class="sh">"</span><span class="p">:</span> <span class="p">[</span><span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">],</span> <span class="sh">"</span><span class="s">lin_vel_y</span><span class="sh">"</span><span class="p">:</span> <span class="p">[</span><span class="o">-</span><span class="mf">0.4</span><span class="p">,</span> <span class="mf">0.4</span><span class="p">],</span> <span class="sh">"</span><span class="s">ang_vel_z</span><span class="sh">"</span><span class="p">:</span> <span class="p">[</span><span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">]})</span>

        <span class="n">self</span><span class="p">.</span><span class="n">last_action</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">zeros</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">action_dim</span><span class="p">,</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">last_infer_time</span> <span class="o">=</span> <span class="n">time</span><span class="p">.</span><span class="nf">time</span><span class="p">()</span>

        <span class="n">self</span><span class="p">.</span><span class="nf">_init_onnx</span><span class="p">(</span><span class="n">onnx_path</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="nf">_init_dof_cmd</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="nf">_init_communication</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="nf">_init_robot_mode</span><span class="p">()</span>

        <span class="n">self</span><span class="p">.</span><span class="n">control_dt</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">control_dt</span><span class="p">)</span> <span class="k">if</span> <span class="n">control_dt</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span> <span class="k">else</span> <span class="nf">float</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">cfg</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">step_dt</span><span class="sh">"</span><span class="p">,</span> <span class="mf">0.02</span><span class="p">))</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_control_thread</span><span class="p">:</span> <span class="n">RecurrentThread</span> <span class="o">|</span> <span class="bp">None</span> <span class="o">=</span> <span class="bp">None</span>

    <span class="nd">@staticmethod</span>
    <span class="k">def</span> <span class="nf">_load_yaml</span><span class="p">(</span><span class="n">path</span><span class="p">:</span> <span class="nb">str</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="n">Dict</span><span class="p">:</span>
        <span class="k">with</span> <span class="nf">open</span><span class="p">(</span><span class="n">path</span><span class="p">,</span> <span class="sh">"</span><span class="s">r</span><span class="sh">"</span><span class="p">)</span> <span class="k">as</span> <span class="n">f</span><span class="p">:</span>
            <span class="n">cfg</span> <span class="o">=</span> <span class="n">yaml</span><span class="p">.</span><span class="nf">safe_load</span><span class="p">(</span><span class="n">f</span><span class="p">)</span>
        <span class="k">if</span> <span class="ow">not</span> <span class="nf">isinstance</span><span class="p">(</span><span class="n">cfg</span><span class="p">,</span> <span class="nb">dict</span><span class="p">):</span>
            <span class="k">raise</span> <span class="nc">RuntimeError</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="si">{</span><span class="n">path</span><span class="si">}</span><span class="s"> does not contain a valid yaml dict</span><span class="sh">"</span><span class="p">)</span>
        <span class="k">return</span> <span class="n">cfg</span>

    <span class="k">def</span> <span class="nf">_init_onnx</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">onnx_path</span><span class="p">:</span> <span class="nb">str</span><span class="p">):</span>
        <span class="n">self</span><span class="p">.</span><span class="n">ort_session</span> <span class="o">=</span> <span class="n">ort</span><span class="p">.</span><span class="nc">InferenceSession</span><span class="p">(</span><span class="n">onnx_path</span><span class="p">,</span> <span class="n">providers</span><span class="o">=</span><span class="p">[</span><span class="sh">"</span><span class="s">CPUExecutionProvider</span><span class="sh">"</span><span class="p">])</span>
        <span class="n">self</span><span class="p">.</span><span class="n">ort_input_name</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">ort_session</span><span class="p">.</span><span class="nf">get_inputs</span><span class="p">()[</span><span class="mi">0</span><span class="p">].</span><span class="n">name</span>
        <span class="n">self</span><span class="p">.</span><span class="n">ort_output_name</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">ort_session</span><span class="p">.</span><span class="nf">get_outputs</span><span class="p">()[</span><span class="mi">0</span><span class="p">].</span><span class="n">name</span>
        <span class="n">input_shape</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">ort_session</span><span class="p">.</span><span class="nf">get_inputs</span><span class="p">()[</span><span class="mi">0</span><span class="p">].</span><span class="n">shape</span>
        <span class="n">output_shape</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">ort_session</span><span class="p">.</span><span class="nf">get_outputs</span><span class="p">()[</span><span class="mi">0</span><span class="p">].</span><span class="n">shape</span>
        <span class="k">if</span> <span class="n">input_shape</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span> <span class="ow">and</span> <span class="nf">len</span><span class="p">(</span><span class="n">input_shape</span><span class="p">)</span> <span class="o">&gt;=</span> <span class="mi">2</span> <span class="ow">and</span> <span class="nf">isinstance</span><span class="p">(</span><span class="n">input_shape</span><span class="p">[</span><span class="mi">1</span><span class="p">],</span> <span class="nb">int</span><span class="p">):</span>
            <span class="k">if</span> <span class="n">input_shape</span><span class="p">[</span><span class="mi">1</span><span class="p">]</span> <span class="o">!=</span> <span class="n">self</span><span class="p">.</span><span class="n">observation_dim</span><span class="p">:</span>
                <span class="k">raise</span> <span class="nc">RuntimeError</span><span class="p">(</span>
                    <span class="sa">f</span><span class="sh">"</span><span class="s">ONNX input dim mismatch: model expects </span><span class="si">{</span><span class="n">input_shape</span><span class="p">[</span><span class="mi">1</span><span class="p">]</span><span class="si">}</span><span class="s">, </span><span class="sh">"</span>
                    <span class="sa">f</span><span class="sh">"</span><span class="s">but current observation dim is </span><span class="si">{</span><span class="n">self</span><span class="p">.</span><span class="n">observation_dim</span><span class="si">}</span><span class="sh">"</span>
                <span class="p">)</span>
        <span class="k">if</span> <span class="n">output_shape</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span> <span class="ow">and</span> <span class="nf">len</span><span class="p">(</span><span class="n">output_shape</span><span class="p">)</span> <span class="o">&gt;=</span> <span class="mi">2</span> <span class="ow">and</span> <span class="nf">isinstance</span><span class="p">(</span><span class="n">output_shape</span><span class="p">[</span><span class="mi">1</span><span class="p">],</span> <span class="nb">int</span><span class="p">):</span>
            <span class="k">if</span> <span class="n">output_shape</span><span class="p">[</span><span class="mi">1</span><span class="p">]</span> <span class="o">!=</span> <span class="n">self</span><span class="p">.</span><span class="n">action_dim</span><span class="p">:</span>
                <span class="k">raise</span> <span class="nc">RuntimeError</span><span class="p">(</span>
                    <span class="sa">f</span><span class="sh">"</span><span class="s">ONNX output dim mismatch: model outputs </span><span class="si">{</span><span class="n">output_shape</span><span class="p">[</span><span class="mi">1</span><span class="p">]</span><span class="si">}</span><span class="s">, </span><span class="sh">"</span>
                    <span class="sa">f</span><span class="sh">"</span><span class="s">but action dim is </span><span class="si">{</span><span class="n">self</span><span class="p">.</span><span class="n">action_dim</span><span class="si">}</span><span class="sh">"</span>
                <span class="p">)</span>

    <span class="nd">@property</span>
    <span class="k">def</span> <span class="nf">observation_dim</span><span class="p">(</span><span class="n">self</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="nb">int</span><span class="p">:</span>
        <span class="k">if</span> <span class="ow">not</span> <span class="nf">hasattr</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="sh">"</span><span class="s">_observation_dim</span><span class="sh">"</span><span class="p">):</span>
            <span class="n">dim</span> <span class="o">=</span> <span class="mi">0</span>
            <span class="k">for</span> <span class="n">name</span><span class="p">,</span> <span class="n">term</span> <span class="ow">in</span> <span class="n">self</span><span class="p">.</span><span class="n">obs_term_builders</span><span class="p">:</span>
                <span class="k">if</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">base_ang_vel</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">dim</span> <span class="o">+=</span> <span class="mi">3</span>
                <span class="k">elif</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">projected_gravity</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">dim</span> <span class="o">+=</span> <span class="mi">3</span>
                <span class="k">elif</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">velocity_commands</span><span class="sh">"</span><span class="p">:</span>
                    <span class="n">dim</span> <span class="o">+=</span> <span class="mi">3</span>
                <span class="k">elif</span> <span class="n">name</span> <span class="ow">in</span> <span class="p">{</span><span class="sh">"</span><span class="s">joint_pos_rel</span><span class="sh">"</span><span class="p">,</span> <span class="sh">"</span><span class="s">joint_vel_rel</span><span class="sh">"</span><span class="p">,</span> <span class="sh">"</span><span class="s">last_action</span><span class="sh">"</span><span class="p">}:</span>
                    <span class="n">dim</span> <span class="o">+=</span> <span class="n">self</span><span class="p">.</span><span class="n">action_dim</span>
                <span class="k">else</span><span class="p">:</span>
                    <span class="k">raise</span> <span class="nc">RuntimeError</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="s">Unsupported observation term: </span><span class="si">{</span><span class="n">name</span><span class="si">}</span><span class="sh">"</span><span class="p">)</span>
            <span class="n">self</span><span class="p">.</span><span class="n">_observation_dim</span> <span class="o">=</span> <span class="nf">int</span><span class="p">(</span><span class="n">dim</span><span class="p">)</span>
        <span class="k">return</span> <span class="n">self</span><span class="p">.</span><span class="n">_observation_dim</span>

    <span class="k">def</span> <span class="nf">_init_dof_cmd</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">head</span><span class="p">[</span><span class="mi">0</span><span class="p">]</span> <span class="o">=</span> <span class="mh">0xFE</span>
        <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">head</span><span class="p">[</span><span class="mi">1</span><span class="p">]</span> <span class="o">=</span> <span class="mh">0xEF</span>
        <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">level_flag</span> <span class="o">=</span> <span class="mh">0xFF</span>
        <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">gpio</span> <span class="o">=</span> <span class="mi">0</span>
        <span class="k">for</span> <span class="n">i</span> <span class="ow">in</span> <span class="nf">range</span><span class="p">(</span><span class="mi">20</span><span class="p">):</span>
            <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">motor_cmd</span><span class="p">[</span><span class="n">i</span><span class="p">].</span><span class="n">mode</span> <span class="o">=</span> <span class="mh">0x01</span>
            <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">motor_cmd</span><span class="p">[</span><span class="n">i</span><span class="p">].</span><span class="n">q</span> <span class="o">=</span> <span class="n">go2</span><span class="p">.</span><span class="n">PosStopF</span>
            <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">motor_cmd</span><span class="p">[</span><span class="n">i</span><span class="p">].</span><span class="n">dq</span> <span class="o">=</span> <span class="n">go2</span><span class="p">.</span><span class="n">VelStopF</span>
            <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">motor_cmd</span><span class="p">[</span><span class="n">i</span><span class="p">].</span><span class="n">kp</span> <span class="o">=</span> <span class="mf">0.0</span>
            <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">motor_cmd</span><span class="p">[</span><span class="n">i</span><span class="p">].</span><span class="n">kd</span> <span class="o">=</span> <span class="mf">0.0</span>
            <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">motor_cmd</span><span class="p">[</span><span class="n">i</span><span class="p">].</span><span class="n">tau</span> <span class="o">=</span> <span class="mf">0.0</span>

    <span class="k">def</span> <span class="nf">_init_communication</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">self</span><span class="p">.</span><span class="n">lowcmd_publisher</span> <span class="o">=</span> <span class="nc">ChannelPublisher</span><span class="p">(</span><span class="sh">"</span><span class="s">rt/lowcmd</span><span class="sh">"</span><span class="p">,</span> <span class="n">LowCmd_</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">lowcmd_publisher</span><span class="p">.</span><span class="nc">Init</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="n">lowstate_subscriber</span> <span class="o">=</span> <span class="nc">ChannelSubscriber</span><span class="p">(</span><span class="sh">"</span><span class="s">rt/lowstate</span><span class="sh">"</span><span class="p">,</span> <span class="n">LowState_</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">lowstate_subscriber</span><span class="p">.</span><span class="nc">Init</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">LowStateMessageHandler</span><span class="p">,</span> <span class="mi">10</span><span class="p">)</span>

        <span class="n">self</span><span class="p">.</span><span class="n">sc</span> <span class="o">=</span> <span class="nc">SportClient</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="n">sc</span><span class="p">.</span><span class="nc">SetTimeout</span><span class="p">(</span><span class="mf">5.0</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">sc</span><span class="p">.</span><span class="nc">Init</span><span class="p">()</span>

        <span class="n">self</span><span class="p">.</span><span class="n">msc</span> <span class="o">=</span> <span class="nc">MotionSwitcherClient</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="n">msc</span><span class="p">.</span><span class="nc">SetTimeout</span><span class="p">(</span><span class="mf">5.0</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">msc</span><span class="p">.</span><span class="nc">Init</span><span class="p">()</span>

    <span class="k">def</span> <span class="nf">_init_robot_mode</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">status</span><span class="p">,</span> <span class="n">result</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">msc</span><span class="p">.</span><span class="nc">CheckMode</span><span class="p">()</span>
        <span class="k">while</span> <span class="n">result</span><span class="p">[</span><span class="sh">"</span><span class="s">name</span><span class="sh">"</span><span class="p">]:</span>
            <span class="n">self</span><span class="p">.</span><span class="n">sc</span><span class="p">.</span><span class="nc">StandDown</span><span class="p">()</span>
            <span class="n">self</span><span class="p">.</span><span class="n">msc</span><span class="p">.</span><span class="nc">ReleaseMode</span><span class="p">()</span>
            <span class="n">time</span><span class="p">.</span><span class="nf">sleep</span><span class="p">(</span><span class="mf">1.0</span><span class="p">)</span>
            <span class="n">status</span><span class="p">,</span> <span class="n">result</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">msc</span><span class="p">.</span><span class="nc">CheckMode</span><span class="p">()</span>
        <span class="k">if</span> <span class="n">status</span> <span class="o">!=</span> <span class="mi">0</span><span class="p">:</span>
            <span class="nf">print</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="s">[WARN] Motion switcher status=</span><span class="si">{</span><span class="n">status</span><span class="si">}</span><span class="s">, result=</span><span class="si">{</span><span class="n">result</span><span class="si">}</span><span class="sh">"</span><span class="p">)</span>

    <span class="k">def</span> <span class="nf">LowStateMessageHandler</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">msg</span><span class="p">:</span> <span class="n">LowState_</span><span class="p">):</span>
        <span class="k">with</span> <span class="n">self</span><span class="p">.</span><span class="n">_state_lock</span><span class="p">:</span>
            <span class="n">self</span><span class="p">.</span><span class="n">low_state</span> <span class="o">=</span> <span class="n">msg</span>

    <span class="k">def</span> <span class="nf">_clip_command</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">cmd</span><span class="p">:</span> <span class="nb">tuple</span><span class="p">[</span><span class="nb">float</span><span class="p">,</span> <span class="nb">float</span><span class="p">,</span> <span class="nb">float</span><span class="p">])</span> <span class="o">-&gt;</span> <span class="n">List</span><span class="p">[</span><span class="nb">float</span><span class="p">]:</span>
        <span class="n">cx</span><span class="p">,</span> <span class="n">cy</span><span class="p">,</span> <span class="n">cz</span> <span class="o">=</span> <span class="n">cmd</span>
        <span class="n">cx_range</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">command_limits</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">lin_vel_x</span><span class="sh">"</span><span class="p">,</span> <span class="p">(</span><span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">))</span>
        <span class="n">cy_range</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">command_limits</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">lin_vel_y</span><span class="sh">"</span><span class="p">,</span> <span class="p">(</span><span class="o">-</span><span class="mf">0.4</span><span class="p">,</span> <span class="mf">0.4</span><span class="p">))</span>
        <span class="n">cz_range</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">command_limits</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">ang_vel_z</span><span class="sh">"</span><span class="p">,</span> <span class="p">(</span><span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">))</span>
        <span class="n">cx</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">np</span><span class="p">.</span><span class="nf">clip</span><span class="p">(</span><span class="n">cx</span><span class="p">,</span> <span class="n">cx_range</span><span class="p">[</span><span class="mi">0</span><span class="p">],</span> <span class="n">cx_range</span><span class="p">[</span><span class="mi">1</span><span class="p">]))</span>
        <span class="n">cy</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">np</span><span class="p">.</span><span class="nf">clip</span><span class="p">(</span><span class="n">cy</span><span class="p">,</span> <span class="n">cy_range</span><span class="p">[</span><span class="mi">0</span><span class="p">],</span> <span class="n">cy_range</span><span class="p">[</span><span class="mi">1</span><span class="p">]))</span>
        <span class="n">cz</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">np</span><span class="p">.</span><span class="nf">clip</span><span class="p">(</span><span class="n">cz</span><span class="p">,</span> <span class="n">cz_range</span><span class="p">[</span><span class="mi">0</span><span class="p">],</span> <span class="n">cz_range</span><span class="p">[</span><span class="mi">1</span><span class="p">]))</span>
        <span class="k">return</span> <span class="p">[</span><span class="n">cx</span><span class="p">,</span> <span class="n">cy</span><span class="p">,</span> <span class="n">cz</span><span class="p">]</span>

    <span class="k">def</span> <span class="nf">get_command</span><span class="p">(</span><span class="n">self</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="nb">tuple</span><span class="p">[</span><span class="nb">float</span><span class="p">,</span> <span class="nb">float</span><span class="p">,</span> <span class="nb">float</span><span class="p">]:</span>
        <span class="k">with</span> <span class="n">self</span><span class="p">.</span><span class="n">_command_lock</span><span class="p">:</span>
            <span class="k">return</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_x</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_y</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_ang</span>

    <span class="k">def</span> <span class="nf">set_command</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">cmd_x</span><span class="p">:</span> <span class="nb">float</span><span class="p">,</span> <span class="n">cmd_y</span><span class="p">:</span> <span class="nb">float</span><span class="p">,</span> <span class="n">cmd_z</span><span class="p">:</span> <span class="nb">float</span><span class="p">):</span>
        <span class="k">with</span> <span class="n">self</span><span class="p">.</span><span class="n">_command_lock</span><span class="p">:</span>
            <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_x</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_y</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_ang</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="nf">_clip_command</span><span class="p">((</span><span class="n">cmd_x</span><span class="p">,</span> <span class="n">cmd_y</span><span class="p">,</span> <span class="n">cmd_z</span><span class="p">))</span>

    <span class="k">def</span> <span class="nf">update_command_delta</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">dx</span><span class="p">:</span> <span class="nb">float</span><span class="p">,</span> <span class="n">dy</span><span class="p">:</span> <span class="nb">float</span><span class="p">,</span> <span class="n">dz</span><span class="p">:</span> <span class="nb">float</span><span class="p">):</span>
        <span class="k">with</span> <span class="n">self</span><span class="p">.</span><span class="n">_command_lock</span><span class="p">:</span>
            <span class="n">cmd</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="nf">_clip_command</span><span class="p">(</span>
                <span class="p">(</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_x</span> <span class="o">+</span> <span class="n">dx</span><span class="p">,</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_y</span> <span class="o">+</span> <span class="n">dy</span><span class="p">,</span>
                    <span class="n">self</span><span class="p">.</span><span class="n">cmd_ang</span> <span class="o">+</span> <span class="n">dz</span><span class="p">,</span>
                <span class="p">)</span>
            <span class="p">)</span>
            <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_x</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_lin_y</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">cmd_ang</span> <span class="o">=</span> <span class="n">cmd</span>

    <span class="k">def</span> <span class="nf">_get_joint_observations</span><span class="p">(</span><span class="n">self</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="nb">tuple</span><span class="p">[</span><span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">,</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">]:</span>
        <span class="k">with</span> <span class="n">self</span><span class="p">.</span><span class="n">_state_lock</span><span class="p">:</span>
            <span class="n">msg</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">low_state</span>
        <span class="k">if</span> <span class="n">msg</span> <span class="ow">is</span> <span class="bp">None</span><span class="p">:</span>
            <span class="k">return</span> <span class="bp">None</span><span class="p">,</span> <span class="bp">None</span>
        <span class="n">q</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">empty</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">action_dim</span><span class="p">,</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
        <span class="n">dq</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">empty</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">action_dim</span><span class="p">,</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
        <span class="k">for</span> <span class="n">i</span><span class="p">,</span> <span class="n">motor_idx</span> <span class="ow">in</span> <span class="nf">enumerate</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">):</span>
            <span class="n">joint_state</span> <span class="o">=</span> <span class="n">msg</span><span class="p">.</span><span class="n">motor_state</span><span class="p">[</span><span class="nf">int</span><span class="p">(</span><span class="n">motor_idx</span><span class="p">)]</span>
            <span class="n">q</span><span class="p">[</span><span class="n">i</span><span class="p">]</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">joint_state</span><span class="p">.</span><span class="n">q</span><span class="p">)</span>
            <span class="n">dq</span><span class="p">[</span><span class="n">i</span><span class="p">]</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">joint_state</span><span class="p">.</span><span class="n">dq</span><span class="p">)</span>
        <span class="k">return</span> <span class="n">q</span><span class="p">,</span> <span class="n">dq</span>

    <span class="k">def</span> <span class="nf">_build_observation</span><span class="p">(</span><span class="n">self</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span> <span class="o">|</span> <span class="bp">None</span><span class="p">:</span>
        <span class="k">with</span> <span class="n">self</span><span class="p">.</span><span class="n">_state_lock</span><span class="p">:</span>
            <span class="n">msg</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">low_state</span>
        <span class="k">if</span> <span class="n">msg</span> <span class="ow">is</span> <span class="bp">None</span><span class="p">:</span>
            <span class="k">return</span> <span class="bp">None</span>

        <span class="n">q</span><span class="p">,</span> <span class="n">dq</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="nf">_get_joint_observations</span><span class="p">()</span>
        <span class="k">if</span> <span class="n">q</span> <span class="ow">is</span> <span class="bp">None</span> <span class="ow">or</span> <span class="n">dq</span> <span class="ow">is</span> <span class="bp">None</span><span class="p">:</span>
            <span class="k">return</span> <span class="bp">None</span>

        <span class="n">base_ang_vel</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">([</span><span class="nf">float</span><span class="p">(</span><span class="n">v</span><span class="p">)</span> <span class="k">for</span> <span class="n">v</span> <span class="ow">in</span> <span class="n">msg</span><span class="p">.</span><span class="n">imu_state</span><span class="p">.</span><span class="n">gyroscope</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
        <span class="n">projected_gravity</span> <span class="o">=</span> <span class="nf">_quat_to_gravity_body</span><span class="p">(</span><span class="n">msg</span><span class="p">.</span><span class="n">imu_state</span><span class="p">.</span><span class="n">quaternion</span><span class="p">,</span> <span class="n">self</span><span class="p">.</span><span class="n">quat_order</span><span class="p">)</span>

        <span class="n">obs</span> <span class="o">=</span> <span class="p">[]</span>
        <span class="n">cmd</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="nf">_clip_command</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="nf">get_command</span><span class="p">()),</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
        <span class="k">for</span> <span class="n">name</span><span class="p">,</span> <span class="n">term</span> <span class="ow">in</span> <span class="n">self</span><span class="p">.</span><span class="n">obs_term_builders</span><span class="p">:</span>
            <span class="k">if</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">base_ang_vel</span><span class="sh">"</span><span class="p">:</span>
                <span class="n">term_val</span> <span class="o">=</span> <span class="n">base_ang_vel</span>
            <span class="k">elif</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">projected_gravity</span><span class="sh">"</span><span class="p">:</span>
                <span class="n">term_val</span> <span class="o">=</span> <span class="n">projected_gravity</span>
            <span class="k">elif</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">velocity_commands</span><span class="sh">"</span><span class="p">:</span>
                <span class="n">term_val</span> <span class="o">=</span> <span class="n">cmd</span>
            <span class="k">elif</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">joint_pos_rel</span><span class="sh">"</span><span class="p">:</span>
                <span class="n">term_val</span> <span class="o">=</span> <span class="n">q</span> <span class="o">-</span> <span class="n">self</span><span class="p">.</span><span class="n">default_joint_pos</span>
            <span class="k">elif</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">joint_vel_rel</span><span class="sh">"</span><span class="p">:</span>
                <span class="n">term_val</span> <span class="o">=</span> <span class="n">dq</span>
            <span class="k">elif</span> <span class="n">name</span> <span class="o">==</span> <span class="sh">"</span><span class="s">last_action</span><span class="sh">"</span><span class="p">:</span>
                <span class="n">term_val</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">last_action</span>
            <span class="k">else</span><span class="p">:</span>
                <span class="k">raise</span> <span class="nc">RuntimeError</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="s">Unsupported observation term: </span><span class="si">{</span><span class="n">name</span><span class="si">}</span><span class="sh">"</span><span class="p">)</span>

            <span class="n">term_scale</span> <span class="o">=</span> <span class="n">term</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">scale</span><span class="sh">"</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">)</span>
            <span class="n">term_clip</span> <span class="o">=</span> <span class="n">term</span><span class="p">.</span><span class="nf">get</span><span class="p">(</span><span class="sh">"</span><span class="s">clip</span><span class="sh">"</span><span class="p">,</span> <span class="bp">None</span><span class="p">)</span>
            <span class="n">obs</span><span class="p">.</span><span class="nf">extend</span><span class="p">(</span><span class="nf">_scale_and_clip</span><span class="p">(</span><span class="n">term_val</span><span class="p">,</span> <span class="n">term_scale</span><span class="p">,</span> <span class="n">term_clip</span><span class="p">).</span><span class="nf">tolist</span><span class="p">())</span>
        <span class="k">return</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">(</span><span class="n">obs</span><span class="p">,</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">).</span><span class="nf">reshape</span><span class="p">(</span><span class="mi">1</span><span class="p">,</span> <span class="o">-</span><span class="mi">1</span><span class="p">)</span>

    <span class="k">def</span> <span class="nf">_infer</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">observation</span><span class="p">:</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">:</span>
        <span class="n">action_raw</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">ort_session</span><span class="p">.</span><span class="nf">run</span><span class="p">([</span><span class="n">self</span><span class="p">.</span><span class="n">ort_output_name</span><span class="p">],</span> <span class="p">{</span><span class="n">self</span><span class="p">.</span><span class="n">ort_input_name</span><span class="p">:</span> <span class="n">observation</span><span class="p">})[</span><span class="mi">0</span><span class="p">]</span>
        <span class="k">if</span> <span class="nf">isinstance</span><span class="p">(</span><span class="n">action_raw</span><span class="p">,</span> <span class="nb">list</span><span class="p">):</span>
            <span class="n">action_raw</span> <span class="o">=</span> <span class="n">action_raw</span><span class="p">[</span><span class="mi">0</span><span class="p">]</span>
        <span class="n">action_raw</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">asarray</span><span class="p">(</span><span class="n">action_raw</span><span class="p">,</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">).</span><span class="nf">reshape</span><span class="p">(</span><span class="o">-</span><span class="mi">1</span><span class="p">)</span>
        <span class="k">if</span> <span class="n">action_raw</span><span class="p">.</span><span class="n">size</span> <span class="o">!=</span> <span class="n">self</span><span class="p">.</span><span class="n">action_dim</span><span class="p">:</span>
            <span class="k">raise</span> <span class="nc">RuntimeError</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="s">Unexpected action size: </span><span class="si">{</span><span class="n">action_raw</span><span class="p">.</span><span class="n">size</span><span class="si">}</span><span class="s">, expected </span><span class="si">{</span><span class="n">self</span><span class="p">.</span><span class="n">action_dim</span><span class="si">}</span><span class="sh">"</span><span class="p">)</span>
        <span class="k">return</span> <span class="n">action_raw</span>

    <span class="k">def</span> <span class="nf">_postprocess_action</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">raw_action</span><span class="p">:</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">)</span> <span class="o">-&gt;</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">:</span>
        <span class="n">action</span> <span class="o">=</span> <span class="n">raw_action</span><span class="p">.</span><span class="nf">astype</span><span class="p">(</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
        <span class="k">if</span> <span class="n">self</span><span class="p">.</span><span class="n">action_clip</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span><span class="p">:</span>
            <span class="n">first_clip</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">action_clip</span><span class="p">[</span><span class="mi">0</span><span class="p">]</span>
            <span class="k">if</span> <span class="nf">isinstance</span><span class="p">(</span><span class="n">first_clip</span><span class="p">,</span> <span class="p">(</span><span class="nb">list</span><span class="p">,</span> <span class="nb">tuple</span><span class="p">)):</span>
                <span class="n">clip_low</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">([</span><span class="nf">float</span><span class="p">(</span><span class="n">v</span><span class="p">[</span><span class="mi">0</span><span class="p">])</span> <span class="k">for</span> <span class="n">v</span> <span class="ow">in</span> <span class="n">self</span><span class="p">.</span><span class="n">action_clip</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
                <span class="n">clip_hi</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">array</span><span class="p">([</span><span class="nf">float</span><span class="p">(</span><span class="n">v</span><span class="p">[</span><span class="mi">1</span><span class="p">])</span> <span class="k">for</span> <span class="n">v</span> <span class="ow">in</span> <span class="n">self</span><span class="p">.</span><span class="n">action_clip</span><span class="p">],</span> <span class="n">dtype</span><span class="o">=</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>
                <span class="n">action</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">clip</span><span class="p">(</span><span class="n">action</span><span class="p">,</span> <span class="n">clip_low</span><span class="p">,</span> <span class="n">clip_hi</span><span class="p">)</span>
            <span class="k">else</span><span class="p">:</span>
                <span class="n">action</span> <span class="o">=</span> <span class="n">np</span><span class="p">.</span><span class="nf">clip</span><span class="p">(</span><span class="n">action</span><span class="p">,</span> <span class="nf">float</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">action_clip</span><span class="p">[</span><span class="mi">0</span><span class="p">]),</span> <span class="nf">float</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">action_clip</span><span class="p">[</span><span class="mi">1</span><span class="p">]))</span>
        <span class="n">action</span> <span class="o">=</span> <span class="n">action</span> <span class="o">*</span> <span class="n">self</span><span class="p">.</span><span class="n">action_scale</span> <span class="o">+</span> <span class="n">self</span><span class="p">.</span><span class="n">action_offset</span>
        <span class="k">return</span> <span class="n">action</span><span class="p">.</span><span class="nf">astype</span><span class="p">(</span><span class="n">np</span><span class="p">.</span><span class="n">float32</span><span class="p">)</span>

    <span class="k">def</span> <span class="nf">_publish_lowcmd</span><span class="p">(</span><span class="n">self</span><span class="p">,</span> <span class="n">action</span><span class="p">:</span> <span class="n">np</span><span class="p">.</span><span class="n">ndarray</span><span class="p">):</span>
        <span class="c1"># action is already mapped to the same order as deploy.yaml observations/actions.
</span>        <span class="k">for</span> <span class="n">i</span><span class="p">,</span> <span class="n">motor_idx</span> <span class="ow">in</span> <span class="nf">enumerate</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">joint_ids_map</span><span class="p">):</span>
            <span class="n">idx</span> <span class="o">=</span> <span class="nf">int</span><span class="p">(</span><span class="n">motor_idx</span><span class="p">)</span>
            <span class="n">cmd</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">motor_cmd</span><span class="p">[</span><span class="n">idx</span><span class="p">]</span>
            <span class="n">cmd</span><span class="p">.</span><span class="n">mode</span> <span class="o">=</span> <span class="mh">0x01</span>
            <span class="n">cmd</span><span class="p">.</span><span class="n">q</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">action</span><span class="p">[</span><span class="n">i</span><span class="p">])</span>
            <span class="n">cmd</span><span class="p">.</span><span class="n">dq</span> <span class="o">=</span> <span class="n">go2</span><span class="p">.</span><span class="n">VelStopF</span>
            <span class="n">cmd</span><span class="p">.</span><span class="n">kp</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">stiffness</span><span class="p">[</span><span class="n">i</span><span class="p">])</span>
            <span class="n">cmd</span><span class="p">.</span><span class="n">kd</span> <span class="o">=</span> <span class="nf">float</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">damping</span><span class="p">[</span><span class="n">i</span><span class="p">])</span>
            <span class="n">cmd</span><span class="p">.</span><span class="n">tau</span> <span class="o">=</span> <span class="mf">0.0</span>

        <span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">.</span><span class="n">crc</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="n">crc</span><span class="p">.</span><span class="nc">Crc</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">lowcmd_publisher</span><span class="p">.</span><span class="nc">Write</span><span class="p">(</span><span class="n">self</span><span class="p">.</span><span class="n">low_cmd</span><span class="p">)</span>

    <span class="k">def</span> <span class="nf">RunOnce</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">observation</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="nf">_build_observation</span><span class="p">()</span>
        <span class="k">if</span> <span class="n">observation</span> <span class="ow">is</span> <span class="bp">None</span><span class="p">:</span>
            <span class="k">return</span>

        <span class="n">raw_action</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="nf">_infer</span><span class="p">(</span><span class="n">observation</span><span class="p">)</span>
        <span class="n">action</span> <span class="o">=</span> <span class="n">self</span><span class="p">.</span><span class="nf">_postprocess_action</span><span class="p">(</span><span class="n">raw_action</span><span class="p">)</span>

        <span class="n">self</span><span class="p">.</span><span class="n">last_action</span> <span class="o">=</span> <span class="n">action</span><span class="p">.</span><span class="nf">copy</span><span class="p">()</span>
        <span class="n">self</span><span class="p">.</span><span class="nf">_publish_lowcmd</span><span class="p">(</span><span class="n">action</span><span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">last_infer_time</span> <span class="o">=</span> <span class="n">time</span><span class="p">.</span><span class="nf">time</span><span class="p">()</span>

    <span class="k">def</span> <span class="nf">Start</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_control_thread</span> <span class="o">=</span> <span class="nc">RecurrentThread</span><span class="p">(</span>
            <span class="n">interval</span><span class="o">=</span><span class="n">self</span><span class="p">.</span><span class="n">control_dt</span><span class="p">,</span>
            <span class="n">target</span><span class="o">=</span><span class="n">self</span><span class="p">.</span><span class="n">RunOnce</span><span class="p">,</span>
            <span class="n">name</span><span class="o">=</span><span class="sh">"</span><span class="s">go2_rl_infer</span><span class="sh">"</span>
        <span class="p">)</span>
        <span class="n">self</span><span class="p">.</span><span class="n">_control_thread</span><span class="p">.</span><span class="nc">Start</span><span class="p">()</span>

    <span class="k">def</span> <span class="nf">Stop</span><span class="p">(</span><span class="n">self</span><span class="p">):</span>
        <span class="k">if</span> <span class="n">self</span><span class="p">.</span><span class="n">_control_thread</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span><span class="p">:</span>
            <span class="n">self</span><span class="p">.</span><span class="n">_control_thread</span><span class="p">.</span><span class="nc">Wait</span><span class="p">(</span><span class="mf">1.0</span><span class="p">)</span>


<span class="k">def</span> <span class="nf">main</span><span class="p">():</span>
    <span class="n">parser</span> <span class="o">=</span> <span class="n">argparse</span><span class="p">.</span><span class="nc">ArgumentParser</span><span class="p">()</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">channel</span><span class="sh">"</span><span class="p">,</span> <span class="n">nargs</span><span class="o">=</span><span class="sh">"</span><span class="s">?</span><span class="sh">"</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="bp">None</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">DDS network iface, same usage as examples</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--onnx</span><span class="sh">"</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="n">DEFAULT_ONNX</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">Path to exported policy.onnx</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--deploy</span><span class="sh">"</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="n">DEFAULT_DEPLOY_YAML</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">Path to deploy.yaml (from unitree_rl_lab run)</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--dt</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">float</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="bp">None</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">Control period. default: deploy.yaml step_dt</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--vx</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">float</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="mf">0.0</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">base_velocity.lin_vel_x</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--vy</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">float</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="mf">0.0</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">base_velocity.lin_vel_y</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--wz</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">float</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="mf">0.0</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">base_velocity.ang_vel_z</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--step-x</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">float</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="mf">0.05</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">Increment size for vx on each key press</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--step-y</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">float</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="mf">0.05</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">Increment size for vy on each key press</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--step-z</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">float</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="mf">0.10</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">Increment size for wz on each key press</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--no-keyboard</span><span class="sh">"</span><span class="p">,</span> <span class="n">action</span><span class="o">=</span><span class="sh">"</span><span class="s">store_true</span><span class="sh">"</span><span class="p">,</span> <span class="nb">help</span><span class="o">=</span><span class="sh">"</span><span class="s">Disable runtime keyboard command input</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--quat-order</span><span class="sh">"</span><span class="p">,</span> <span class="n">choices</span><span class="o">=</span><span class="p">(</span><span class="sh">"</span><span class="s">wxyz</span><span class="sh">"</span><span class="p">,</span> <span class="sh">"</span><span class="s">xyzw</span><span class="sh">"</span><span class="p">),</span> <span class="n">default</span><span class="o">=</span><span class="sh">"</span><span class="s">wxyz</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">parser</span><span class="p">.</span><span class="nf">add_argument</span><span class="p">(</span><span class="sh">"</span><span class="s">--domain</span><span class="sh">"</span><span class="p">,</span> <span class="nb">type</span><span class="o">=</span><span class="nb">int</span><span class="p">,</span> <span class="n">default</span><span class="o">=</span><span class="mi">0</span><span class="p">)</span>
    <span class="n">args</span> <span class="o">=</span> <span class="n">parser</span><span class="p">.</span><span class="nf">parse_args</span><span class="p">()</span>

    <span class="nf">print</span><span class="p">(</span><span class="sh">"</span><span class="s">WARNING: Make sure area around the robot is clear and robot is ready.</span><span class="sh">"</span><span class="p">)</span>
    <span class="nf">input</span><span class="p">(</span><span class="sh">"</span><span class="s">Press Enter to continue...</span><span class="sh">"</span><span class="p">)</span>

    <span class="k">if</span> <span class="n">args</span><span class="p">.</span><span class="n">channel</span> <span class="ow">is</span> <span class="bp">None</span><span class="p">:</span>
        <span class="nc">ChannelFactoryInitialize</span><span class="p">(</span><span class="n">args</span><span class="p">.</span><span class="n">domain</span><span class="p">)</span>
    <span class="k">else</span><span class="p">:</span>
        <span class="nc">ChannelFactoryInitialize</span><span class="p">(</span><span class="n">args</span><span class="p">.</span><span class="n">domain</span><span class="p">,</span> <span class="n">args</span><span class="p">.</span><span class="n">channel</span><span class="p">)</span>

    <span class="n">runner</span> <span class="o">=</span> <span class="nc">Go2RlExample</span><span class="p">(</span>
        <span class="n">onnx_path</span><span class="o">=</span><span class="n">args</span><span class="p">.</span><span class="n">onnx</span><span class="p">,</span>
        <span class="n">deploy_cfg_path</span><span class="o">=</span><span class="n">args</span><span class="p">.</span><span class="n">deploy</span><span class="p">,</span>
        <span class="n">quat_order</span><span class="o">=</span><span class="n">args</span><span class="p">.</span><span class="n">quat_order</span><span class="p">,</span>
        <span class="n">command</span><span class="o">=</span><span class="p">(</span><span class="n">args</span><span class="p">.</span><span class="n">vx</span><span class="p">,</span> <span class="n">args</span><span class="p">.</span><span class="n">vy</span><span class="p">,</span> <span class="n">args</span><span class="p">.</span><span class="n">wz</span><span class="p">),</span>
        <span class="n">control_dt</span><span class="o">=</span><span class="n">args</span><span class="p">.</span><span class="n">dt</span><span class="p">,</span>
    <span class="p">)</span>
    <span class="n">publish_hz</span> <span class="o">=</span> <span class="mf">1.0</span> <span class="o">/</span> <span class="n">runner</span><span class="p">.</span><span class="n">control_dt</span> <span class="k">if</span> <span class="n">runner</span><span class="p">.</span><span class="n">control_dt</span> <span class="o">&gt;</span> <span class="mi">0</span> <span class="k">else</span> <span class="mf">0.0</span>
    <span class="nf">print</span><span class="p">(</span><span class="sa">f</span><span class="sh">"</span><span class="s">[INFO] lowcmd publish interval = </span><span class="si">{</span><span class="n">runner</span><span class="p">.</span><span class="n">control_dt</span><span class="si">:</span><span class="p">.</span><span class="mi">4</span><span class="n">f</span><span class="si">}</span><span class="s">s =&gt; </span><span class="si">{</span><span class="n">publish_hz</span><span class="si">:</span><span class="p">.</span><span class="mi">2</span><span class="n">f</span><span class="si">}</span><span class="s"> Hz</span><span class="sh">"</span><span class="p">)</span>
    <span class="n">runner</span><span class="p">.</span><span class="nc">Start</span><span class="p">()</span>
    <span class="n">kb</span> <span class="o">=</span> <span class="bp">None</span>
    <span class="k">if</span> <span class="ow">not</span> <span class="n">args</span><span class="p">.</span><span class="n">no_keyboard</span><span class="p">:</span>
        <span class="n">kb</span> <span class="o">=</span> <span class="nc">KeyboardController</span><span class="p">(</span><span class="n">runner</span><span class="p">,</span> <span class="n">step_x</span><span class="o">=</span><span class="n">args</span><span class="p">.</span><span class="n">step_x</span><span class="p">,</span> <span class="n">step_y</span><span class="o">=</span><span class="n">args</span><span class="p">.</span><span class="n">step_y</span><span class="p">,</span> <span class="n">step_z</span><span class="o">=</span><span class="n">args</span><span class="p">.</span><span class="n">step_z</span><span class="p">)</span>
        <span class="n">kb</span><span class="p">.</span><span class="nf">start</span><span class="p">()</span>

    <span class="k">try</span><span class="p">:</span>
        <span class="k">while</span> <span class="bp">True</span><span class="p">:</span>
            <span class="n">time</span><span class="p">.</span><span class="nf">sleep</span><span class="p">(</span><span class="mf">1.0</span><span class="p">)</span>
    <span class="k">except</span> <span class="nb">KeyboardInterrupt</span><span class="p">:</span>
        <span class="nf">print</span><span class="p">(</span><span class="sh">"</span><span class="s">Stopping...</span><span class="sh">"</span><span class="p">)</span>
    <span class="k">finally</span><span class="p">:</span>
        <span class="k">if</span> <span class="n">kb</span> <span class="ow">is</span> <span class="ow">not</span> <span class="bp">None</span><span class="p">:</span>
            <span class="n">kb</span><span class="p">.</span><span class="nf">stop</span><span class="p">()</span>
        <span class="n">runner</span><span class="p">.</span><span class="nc">Stop</span><span class="p">()</span>


<span class="k">if</span> <span class="n">__name__</span> <span class="o">==</span> <span class="sh">"</span><span class="s">__main__</span><span class="sh">"</span><span class="p">:</span>
    <span class="nf">main</span><span class="p">()</span>

</pre></table></code></div></div></details><h3 id="test-1"><span class="me-2">test 1.</span><a href="#test-1" class="anchor text-muted"><i class="fas fa-hashtag"></i></a></h3><ul><li>로봇개에 랜선을 연결하였을때 eno1 네트워크 인터페이스가 잡혔습니다.<li>go2에 /lowcmd를 전달하기 위해서는 기존에 go2내부에서 작동하고 있던 모든 컨트롤 시스템을 shutdown하는 작업이 필수적이였습니다.<ul><li>이를 위해서 unitree_sdk2_python에 있던 msc 인터페이스를 통해 rl을 명령을 내릴 수 있었습니다.<div class="language-python highlighter-rouge"><div class="code-header"> <span data-label-text="Python"><i class="fas fa-code fa-fw small"></i></span> <button aria-label="copy" data-title-succeed="복사되었습니다!"><i class="far fa-clipboard"></i></button></div><div class="highlight"><code><table class="rouge-table"><tbody><tr><td class="rouge-gutter gl"><pre class="lineno">1
2
3
</pre><td class="rouge-code"><pre><span class="n">self</span><span class="p">.</span><span class="n">msc</span> <span class="o">=</span> <span class="nc">MotionSwitcherClient</span><span class="p">()</span>
<span class="n">self</span><span class="p">.</span><span class="n">msc</span><span class="p">.</span><span class="nc">SetTimeout</span><span class="p">(</span><span class="mf">5.0</span><span class="p">)</span>
<span class="n">self</span><span class="p">.</span><span class="n">msc</span><span class="p">.</span><span class="nc">Init</span><span class="p">()</span>
</pre></table></code></div></div><p><a href="/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80c7-bb29-c37f639f4d00.gif" class="popup img-link shimmer"><img src="/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-80c7-bb29-c37f639f4d00.gif" alt="" loading="lazy"></a></p></ul></ul><p><a href="/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-804d-a349-ddca6da9759a.webp" class="popup img-link shimmer"><img src="/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-first-challenge/321cbb7d-7937-804d-a349-ddca6da9759a.webp" alt="" loading="lazy"></a></p><ul><li>[1.0, 0.4, -1.0] 과 같은 명령을 주었는데도 go2 로봇이 발을 떼지 않는 문제가 있습니다. 방향에 따라 몸통을 기울이기는 하지만 go2가 실제로 움직이지는 않는 상황입니다. 예상되는 원인은 아래와 같습니다.<ol><li>depoly시에 observation으로 주는 값이 train과 같지 않다.<li>imu 정보를 읽어오는 부분에서 좌표계가 꼬였다.<li>보상중에 발을 땅에서 떼도록 하는 feet_air_time과 feet_slide의 가중치가 잘못 되었다.</ol></ul>
{% endraw %}
