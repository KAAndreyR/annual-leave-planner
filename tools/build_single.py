"""Собирает планировщик в один HTML-файл: стили и скрипты встраиваются в страницу.

Запуск из корня репозитория:  python tools/build_single.py
Результат: dist/annual-leave-planner.html
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "annual-leave-planner.html"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8").strip("\n")


def main() -> None:
    page = read("index.html")

    css_tag = '<link rel="stylesheet" href="css/style.css">'
    assert css_tag in page, "css link not found"
    page = page.replace(css_tag, "<style>\n" + read("css/style.css") + "\n</style>")

    def inline_script(m: re.Match) -> str:
        code = read(m.group(1))
        assert "</script" not in code.lower(), f"{m.group(1)} contains </script>"
        return "<script>\n" + code + "\n</script>"

    page, n = re.subn(r'<script src="(js/[^"]+)"></script>', inline_script, page)
    assert n > 0, "no scripts found"

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(page + "\n", encoding="utf-8", newline="\n")
    print(f"{OUT.relative_to(ROOT)}: {n} scripts, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
