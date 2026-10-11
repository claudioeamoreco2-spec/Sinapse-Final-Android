#!/usr/bin/env python3
"""Compile and exercise native policy/TTS helpers with a JDK, no Android SDK needed."""
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parent.parent
    java = shutil.which("java")
    if java is None:
        raise SystemExit("Java 17+ is required for the Android core checks.")
    package = root / "app/src/main/java/com/sinapsefinal/leitor"
    sources = [package / "OfflineAssetPolicy.java", package / "SpeechChunks.java",
               root / "scripts/tests/AndroidCoreTest.java"]
    with tempfile.TemporaryDirectory(prefix="sinapse-java-") as classes:
        # Some managed runtimes retain jdk.compiler but omit the ct.sym archive used by --release.
        # The helpers use Java 17 APIs; CI runs this same check on a complete JDK 17.
        subprocess.run([java, "-m", "jdk.compiler/com.sun.tools.javac.Main", "-source", "17", "-target", "17",
                        "-d", classes, *map(str, sources)], check=True)
        subprocess.run([java, "-cp", classes, "com.sinapsefinal.leitor.AndroidCoreTest"], check=True)


if __name__ == "__main__":
    main()
