# Сборка исполняемого файла: pyinstaller Attestation.spec
a = Analysis(
    ["run.py"],
    datas=[("attestation/data", "attestation/data")],
    excludes=["docx", "pytest"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name="Attestation",
    console=False,
    upx=False,
)
