"""BGM 템포(BPM)·첫 박·본 구간 시작을 추정한다. manifest.json에 넣을 값을 출력.

usage: python reels/tools/beats.py [파일.mp3 ...]   (인자 없으면 assets/audio/bgm/*.mp3 전부)
필요: ffmpeg, numpy
출력 start 값 = 첫 박 위치. loud_start_s가 1초 이상이면(인트로가 조용하면)
start = first_beat + ceil((loud_start_s - first_beat) / (60/bpm)) * (60/bpm) 로 본 구간 첫 박을 쓴다.
"""
import glob
import json
import os
import subprocess
import sys

import numpy as np

SR, HOP = 22050, 256
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def load(f, ss=0, t=40):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(ss), '-t', str(t), '-i', f,
                          '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def onset_env(x):
    n = 2048
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::HOP] * np.hanning(n)
    spec = np.log1p(10 * np.abs(np.fft.rfft(frames, axis=1)))
    d = np.maximum(0, np.diff(spec, axis=0)).sum(1)
    d = np.maximum(d - np.convolve(d, np.ones(16) / 16, 'same'), 0)
    return d / (d.max() + 1e-9)


def analyze(f):
    x = load(f)
    env, fps = onset_env(x), SR / HOP
    ac = np.correlate(env, env, 'full')[len(env) - 1:]
    best = None
    for bpm in np.arange(70, 170, 0.25):
        lag = 60 * fps / bpm
        s = sum(np.interp(k * lag, np.arange(len(ac)), ac) / k ** 0.3 for k in (1, 2, 4))
        s *= np.exp(-0.5 * ((np.log2(bpm / 115)) / 0.6) ** 2)  # 90~130 BPM 쪽으로 약하게 유도
        if best is None or s > best[0]:
            best = (s, bpm)
    bpm = best[1]
    period = 60 * fps / bpm
    phase = max(np.arange(0, period, 0.5),
                key=lambda p: np.interp(np.arange(p, len(env), period), np.arange(len(env)), env).sum())
    rms = np.sqrt(np.convolve(x ** 2, np.ones(SR) / SR, 'valid'))[::SR // 4]
    return {'bpm': round(float(bpm), 2), 'first_beat': round(float(phase / fps), 3),
            'loud_start_s': round(float(np.argmax(rms > 0.5 * rms.max()) / 4), 2)}


if __name__ == '__main__':
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'assets/audio/bgm/*.mp3')))
    print(json.dumps({os.path.basename(f): analyze(f) for f in files}, indent=1, ensure_ascii=False))
