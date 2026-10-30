from pathlib import Path
import math
import random
import struct
import wave

RATE = 44100
ROOT = Path(__file__).resolve().parents[1] / "assets" / "previews"
rng = random.Random(1739)


def render(kind):
    duration = .32 if kind == "impact" else .92
    values = []
    phase = 0.0
    smooth = 0.0
    for index in range(round(duration * RATE)):
        t = index / RATE
        p = t / duration
        noise = rng.uniform(-1, 1)
        smooth = smooth * .82 + noise * .18
        attack = min(1, t / .004)
        release = min(1, (duration - t) / .05)
        if kind == "impact":
            phase += math.tau * (46 + 100 * math.exp(-t * 30)) / RATE
            value = .8 * math.sin(phase) * math.exp(-t * 15) + .5 * (noise - smooth) * math.exp(-t * 32)
        else:
            frequency = 430 + 440 * math.sin(p * math.pi) + 22 * math.sin(t * 37)
            phase += math.tau * frequency / RATE
            envelope = math.sin(math.pi * p) ** .65
            value = envelope * (.5 * math.sin(phase) + .18 * math.sin(phase * 2.03) + .12 * math.sin(phase * 3.1) + .22 * (noise - smooth))
            value *= .8 + .2 * math.sin(t * 83)
        values.append(math.tanh(value) * attack * release)
    peak = max(abs(value) for value in values)
    frames = bytearray()
    for index, value in enumerate(values):
        left = value / peak * .42
        right = (value * .95 + values[max(0, index - 67)] * .05) / peak * .42
        frames.extend(struct.pack("<hh", round(left * 32767), round(right * 32767)))
    dest = ROOT / f"jump-{kind}.wav"
    with wave.open(str(dest), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(frames)
    print(f"{dest.name}: {duration:.2f}s, peak 0.42")


ROOT.mkdir(parents=True, exist_ok=True)
for kind in ("impact", "scream"):
    render(kind)
