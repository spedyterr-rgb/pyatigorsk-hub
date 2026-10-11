# Ежедневный замер скачиваний: дописывает строку в data/history.json. Запускается из GitHub Actions.
import json, subprocess, datetime
cfg = json.load(open("data/games.json", encoding="utf-8"))
counts = {}
for repo in [cfg["repo"]] + cfg.get("extraRepos", []):
    try:
        out = subprocess.run(["gh", "api", "repos/%s/%s/releases?per_page=100" % (cfg["user"], repo)], capture_output=True, text=True, check=True).stdout
        for rel in json.loads(out):
            for a in rel.get("assets", []):
                counts[a["name"]] = counts.get(a["name"], 0) + a["download_count"]
    except Exception as e:
        print("skip", repo, e)
games = {g["id"]: sum(counts.get(f["name"], 0) for f in g["files"]) for g in cfg["games"]}
today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
try: hist = json.load(open("data/history.json", encoding="utf-8"))
except Exception: hist = []
hist = [h for h in hist if h.get("date") != today] + [{"date": today, "games": games}]
json.dump(hist[-400:], open("data/history.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(today, games)
