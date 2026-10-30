from pathlib import Path
import wave
import numpy as np

RATE = 22050
DURATION = 14
TIME = np.arange(RATE * DURATION) / RATE
RNG = np.random.default_rng(731)
OUTPUT = Path("assets/previews")
OUTPUT.mkdir(parents=True, exist_ok=True)


def note(frequency, start, duration, level=0.15):
    local = TIME - start
    active = (local >= 0) & (local < duration)
    t = np.maximum(local, 0)
    attack = 1 - np.exp(-t * 75)
    envelope = attack * np.exp(-t / 2.8) * active
    sound = np.zeros_like(TIME)
    for harmonic, gain in [(1, 1), (2.003, .32), (3.01, .17), (4.08, .06)]:
        sound += gain * np.sin(2 * np.pi * frequency * harmonic * t + .007 * np.sin(2 * np.pi * 3.2 * t))
    return sound * envelope * level


def pad(frequencies, level=0.07):
    sound = np.zeros_like(TIME)
    for index, frequency in enumerate(frequencies):
        flutter = .4 * np.sin(2 * np.pi * (.11 + index * .017) * TIME)
        phase = 2 * np.pi * frequency * TIME + flutter
        sound += (np.sin(phase) + .2 * np.sin(phase * 2.001)) / len(frequencies)
    return sound * level * (.7 + .3 * np.sin(2 * np.pi * .07 * TIME) ** 2)


def noise(level=0.009):
    values = RNG.normal(size=len(TIME))
    smooth = np.convolve(values, np.ones(31) / 31, mode="same")
    return smooth * level * (1 + .4 * np.sin(2 * np.pi * .3 * TIME))


def save(name, signal):
    stereo = np.column_stack([signal.copy(), signal.copy()])
    for delay, level in [(.19, .22), (.41, .15), (.79, .09), (1.27, .05)]:
        offset = int(delay * RATE)
        stereo[offset:, 0] += signal[:-offset] * level
        stereo[offset + 37:, 1] += signal[:-(offset + 37)] * level
    fade = np.minimum(1, TIME / 1.2) * np.minimum(1, (DURATION - TIME) / 1.8)
    stereo *= fade[:, None]
    stereo *= .42 / max(np.max(np.abs(stereo)), .001)
    target = OUTPUT / name
    with wave.open(str(target), "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes((stereo * 32767).astype("<i2").tobytes())
    print(f"{target}: {DURATION}s stereo, peak {np.max(np.abs(stereo)):.2f}")


piano = pad([55, 82.4, 110.3, 116.54], .1) + noise(.015)
for frequency, start in [(220, .8), (233.08, 3.1), (164.81, 6.4), (220, 9.2), (207.65, 11.1)]:
    piano += note(frequency, start, 7, .12)
save("a-dark-piano.wav", piano)

pressure = pad([48.9, 65.4, 98.2, 104], .13) + noise(.035)
for start in np.arange(.8, 13, 1.6):
    local = TIME - start
    pulse = np.exp(-np.maximum(local, 0) * 14) * (local >= 0)
    pressure += .08 * np.sin(2 * np.pi * 68 * local) * pulse
for frequency, start in [(392, 2.4), (415.3, 7.8), (293.66, 11.3)]:
    pressure += note(frequency, start, 4, .045)
save("b-analog-pressure.wav", pressure)
