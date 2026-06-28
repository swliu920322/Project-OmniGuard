import os
from datetime import datetime, timedelta

class DailyCacheManager:
    """
    缓存管理器：专门管理本地文件缓存，控制 AI 的调用频次与计算成本
    """

    def __init__(self, cache_dir=None):
        if cache_dir is None:
            # 动态定位到 backend/daily_cache/ 目录，保证执行路径独立性
            current_dir = os.path.dirname(os.path.abspath(__file__))
            cache_dir = os.path.join(os.path.dirname(current_dir), "daily_cache")
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        # 动态计算高频波动的缓冲期
        self.today = datetime.now().strftime("%Y-%m-%d")
        self.yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    def get_summary(self, date: str) -> str | None:
        """尝试读取缓存。如果是今天或昨天，或者文件不存在，返回 None（触发实时 AI 计算）"""
        if date == self.today or date == self.yesterday:
            return None  # 缓冲期强制穿透调 AI

        path = self._get_file_path(date)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return None

    def save_summary(self, date: str, content: str):
        """将 AI 提炼的快照持久化到本地"""
        path = self._get_file_path(date)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def save_raw_tweets(self, user_id: str, raw_data: dict):
        """将原始获取到的 JSON 数据持久化到本地"""
        import json
        path = os.path.join(self.cache_dir, f"raw_{user_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=4)

    def get_report(self, user_id: str) -> dict | None:
        """获取已生成的报告 JSON 数据"""
        import json
        path = os.path.join(self.cache_dir, f"report_{user_id}.json")
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def _get_file_path(self, date: str) -> str:
        return os.path.join(self.cache_dir, f"{date}.txt")
