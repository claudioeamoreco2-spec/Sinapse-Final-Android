import math, random, struct, wave
from pathlib import Path

rate, duration = 22050, 36
output = Path("app/src/main/assets/audio/nerakar-tempestade.wav")
output.parent.mkdir(parents=True, exist_ok=True)
random.seed(7)
with wave.open(str(output), "w") as audio:
    audio.setparams((1, 2, rate, duration * rate, "NONE", "not compressed"))
    frames = bytearray()
    for i in range(duration * rate):
        t = i / rate
        pad = sum(math.sin(2 * math.pi * f * t) for f in (55, 65.41, 82.41)) / 3
        pulse = math.sin(2 * math.pi * 1.25 * t) ** 9 * math.sin(2 * math.pi * 110 * t)
        rain = random.uniform(-1, 1) * 0.06
        shimmer = math.sin(2 * math.pi * (430 + 18 * math.sin(t / 3)) * t) * 0.025
        fade = min(1, t / 3, (duration - t) / 3)
        value = max(-1, min(1, fade * (0.24 * pad + 0.1 * pulse + rain + shimmer)))
        frames += struct.pack("<h", int(value * 32767))
    audio.writeframes(frames)
