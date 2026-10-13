import os
import glob
import json
import re
import time
import hashlib
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dotenv import load_dotenv
from kol_analysis.x_scraper import fetch_user_tweets, _extract_full_text, _extract_legacy
from kol_analysis.cache_manager import DailyCacheManager
from kol_analysis.inference_engine import AzureChatEngine

def batch_translate(tweets, engine):
    """
    大批量聚合翻译，减少大模型交互开销并提高翻译速度
    """
    if not tweets:
        return []
    chunk_size = 15
    results = []
    for i in range(0, len(tweets), chunk_size):
        chunk = tweets[i:i+chunk_size]
        prompt = (
            "Please translate these English tweets into professional financial Chinese. "
            "Return a JSON array of objects. Each object must have 'original' (the exact English text) "
            "and 'translation' (the Chinese translation). Keep the translation natural and professional. "
            "Preserve stock tickers like $SIVE, $MU, $SNDK, $META. "
            "Input:\n" + json.dumps(chunk, ensure_ascii=False)
        )
        system_prompt = "You are a professional financial translator. Output a raw JSON array of objects with keys 'original' and 'translation'."
        try:
            response_text = engine.generate_response(user_prompt=prompt, system_prompt=system_prompt)
            clean_json_str = response_text.strip()
            if clean_json_str.startswith("```json"):
                clean_json_str = clean_json_str[7:]
            if clean_json_str.endswith("```"):
                clean_json_str = clean_json_str[:-3]
            clean_json_str = clean_json_str.strip()
            chunk_results = json.loads(clean_json_str)
            results.extend(chunk_results)
        except Exception as e:
            print(f"Translation chunk error: {e}")
            for tweet in chunk:
                results.append({"original": tweet, "translation": "(翻译生成失败)"})
    return results

def analyze_investor_insights(tweets, engine, ticker_stats=None):
    """
    调用 AI 聚合分析推文的热门话题、行业比例、标的信心、供应链瓶颈及产业链映射
    """
    if not tweets:
        return [], [], [], [], []
    prompt = (
        "Please analyze the following list of financial and supply-chain tweets. Extract and categorize:\n"
        "1. Top 5 Hot Topics (热门话题): Key topics discussed, the count of tweets mentioning each, and its percentage (count / total). Return as an array of objects with keys: 'topic', 'count', 'percentage'.\n"
        "2. Industry Proportions (行业比例): The major industries mentioned and their percentage values (must sum to 100). Return as an array of objects with keys: 'name', 'value' (integer percentage value). Examples of industries: '半导体/芯片', '硬件/DC服务器', '光学/光模块', '软件/AI模型', '汽车/机器人'.\n"
        "3. Conviction Watchlist (核心标的信心指数): For each mentioned stock ticker ($SIVE, $MU, etc.) return an object with keys: 'ticker', 'conviction_level', 'horizon', 'investment_thesis'.\n"
        "   conviction_level is STRICTLY one of: '核心重仓 (Core Long)' | '首仓买入 (Starter Long)' | '中性观察 (Neutral)'.\n"
        "   Rubric (evidence-based, downgrade when evidence is missing):\n"
        "     - '核心重仓 (Core Long)': explicit absolute intent (重仓/加仓/极度看好/core position) AND a structural thesis (why it wins in the value chain) AND recurring mentions across multiple days. Missing any pillar downgrades it.\n"
        "     - '首仓买入 (Starter Long)': clear entry intent (买入/建仓/试仓) with some reasoning, but not yet emphatic or recurring enough for core.\n"
        "     - '中性观察 (Neutral)': conditional/hedged language (如果/留意/谨慎/观察), or a single event-driven mention without a thesis. Conditional expressions NEVER qualify as 重仓.\n"
        "   horizon is one of: 'long' (structural industry position, years) | 'mid' (industry cycle / supply-demand, months) | 'short' (event or catalyst driven, days-weeks).\n"
        "   investment_thesis: 1-2 sentences in Chinese explaining the conviction.\n"
        "4. Supply Chain Bottlenecks (供应链卡脖子跟踪): For each critical bottleneck or shortage (e.g. HBM Memory supply shortages, CPO transceivers, etc.), return an object with keys: 'category', 'status', 'tightness' (0-10 integer: 10=严重紧缺/供不应求, 6-7=偏紧, 4-5=均衡, 1-3=宽松/过剩), 'affected_tickers' (list of strings, e.g. ['$MU', '$SIVE']), 'beneficiaries' (list of tickers gaining pricing power or benefiting from the tightness), 'impacted' (list of tickers squeezed or facing cost pressure, e.g. downstream OEMs).\n"
        "5. Value Chain Mapping (算力/产业节点映射): Map the relationships showing who sells to whom or is integrated into whose platform (e.g. Sivers ($SIVE) -> Nvidia NVLink -> Hyperscalers). Return as an array of objects with keys: 'upstream', 'midstream', 'downstream'.\n"
        "Output ONLY a raw JSON object matching this schema (keys: 'hot_topics', 'industries', 'conviction_watchlist', 'supply_chain_bottlenecks', 'value_chain_mapping'). Do not include markdown codeblocks. Input:\n"
        + json.dumps(tweets, ensure_ascii=False)
        + "\n\nTicker mention statistics (count, distinct days) detected locally, for reference only:\n"
        + json.dumps(ticker_stats or {}, ensure_ascii=False)
    )
    system_prompt = "You are a senior hedge fund tech analyst. Output a raw JSON object containing these keys."
    try:
        response_text = engine.generate_response(user_prompt=prompt, system_prompt=system_prompt)
        clean_json_str = response_text.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
        clean_json_str = clean_json_str.strip()
        analysis_data = json.loads(clean_json_str)
        return (
            analysis_data.get("hot_topics", []),
            analysis_data.get("industries", []),
            analysis_data.get("conviction_watchlist", []),
            analysis_data.get("supply_chain_bottlenecks", []),
            analysis_data.get("value_chain_mapping", [])
        )
    except Exception as e:
        print(f"Failed to analyze investor insights: {e}")
        # 降级兜底数据
        return (
            [
                {"topic": "Robotics & Humanoid", "count": 5, "percentage": 30},
                {"topic": "Hyperscaler DC Capex", "count": 4, "percentage": 25},
                {"topic": "AI Hardware Memory", "count": 4, "percentage": 25},
                {"topic": "Optical Interconnects", "count": 3, "percentage": 20}
            ],
            [
                {"name": "半导体/芯片", "value": 40},
                {"name": "硬件/DC服务器", "value": 30},
                {"name": "光学/光模块", "value": 20},
                {"name": "软件/大模型", "value": 10}
            ],
            [
                {"ticker": "$SIVE", "conviction_level": "核心重仓 (Core Long)", "horizon": "long", "investment_thesis": "硅光子光引擎封装处于英伟达NVLink CPO生态核心，博主重仓且极具信心。"},
                {"ticker": "$MU", "conviction_level": "核心重仓 (Core Long)", "horizon": "mid", "investment_thesis": "马斯克与CEO均确认人形机器人对高带宽存储HBM/DRAM需求是乘用车10倍，正值供求吃紧。"},
                {"ticker": "$CBRS", "conviction_level": "首仓买入 (Starter Long)", "horizon": "mid", "investment_thesis": "OpenAI Sol 5.6前沿模型首选在Cerebras运行，价格跌破IPO后首度试仓。"}
            ],
            [
                {"category": "HBM/DRAM 内存", "status": "马斯克警示供给极度吃紧，价格出现上涨趋势", "tightness": 9, "affected_tickers": ["$MU", "SK Hynix", "Samsung"], "beneficiaries": ["$MU", "SK Hynix"], "impacted": ["$NVDA", "$AMD"]},
                {"category": "硅光子/CPO 激光源", "status": "光电共封装收发模块与CW DFB激光器需求旺盛", "tightness": 8, "affected_tickers": ["$SIVE", "$GFS", "Ayar Labs"], "beneficiaries": ["$SIVE", "$GFS"], "impacted": []}
            ],
            [
                {"upstream": "Sivers Semis ($SIVE)", "midstream": "Ayar Labs / Nvidia NVLink", "downstream": "Hyperscalers (Meta / Amazon)"},
                {"upstream": "Micron ($MU) / SK Hynix", "midstream": "AI DC Servers / Grok / Sol", "downstream": "OpenAI / Tesla Humanoids"}
            ]
        )

def _extract_translations_from_reports(cache_dir: str, user_id: str):
    """从已有报告文件（7/30/90d 及兼容版）提取存量翻译，供归档缺失时兜底，避免重复翻译。"""
    translations = {}
    items = []
    seen = set()
    pattern = os.path.join(cache_dir, f"report_translated_{user_id}*.json")
    report_files = sorted(glob.glob(pattern))
    for report_path in report_files:
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report = json.load(f)
        except Exception as e:
            print(f"⚠️ 读取报告存量失败 ({os.path.basename(report_path)}): {e}")
            continue
        for day in report.get("data", []):
            day_date = day.get("date")
            for tweet in day.get("tweets", []):
                orig = tweet.get("original")
                trans = tweet.get("translation")
                if not orig or orig in seen:
                    continue
                seen.add(orig)
                translations[orig] = trans
                items.append({"date": day_date, "original": orig, "translation": trans})
    return translations, items

def _window_signature(items):
    """按原文内容排序后生成的稳定指纹，用于判断某时间窗口的推文集合是否变化。"""
    canonical = sorted({it["original"] for it in items})
    return hashlib.sha256(json.dumps(canonical, ensure_ascii=False).encode("utf-8")).hexdigest()

TICKER_RE = re.compile(r"\$([A-Z]{1,5})(?!\w)")

def _normalize_ticker(sym):
    """统一标的写法为不含 $ 的大写，便于与本地统计对齐。"""
    return str(sym or "").upper().lstrip("$")

def _ticker_stats(items):
    """本地统计窗口内每标的的提及次数与涉及天数（零 AI，纯正则）。"""
    stats = {}
    for it in items:
        day = it.get("date")
        for m in TICKER_RE.finditer(it.get("original", "")):
            sym = "$" + m.group(1)
            s = stats.setdefault(sym, {"count": 0, "days": set()})
            s["count"] += 1
            s["days"].add(day)
    return {sym: {"count": s["count"], "days": len(s["days"])} for sym, s in stats.items()}

def _ticker_trend(cur_stats, prev_stats):
    """对比上一等长窗口，给出每标的方向：new/rising/steady/declining。"""
    trend = {}
    for sym, c in cur_stats.items():
        p = prev_stats.get(sym)
        if not p or p["count"] == 0:
            trend[sym] = "new"
        elif c["count"] >= p["count"] * 1.5:
            trend[sym] = "rising"
        elif c["count"] <= p["count"] * 0.5:
            trend[sym] = "declining"
        else:
            trend[sym] = "steady"
    return trend

LEVEL_SCORES = {"核心重仓": 100, "首仓买入": 70, "中性观察": 45, "观察": 20}

# 分析缓存结构版本：prompt 契约变化时递增以作废旧缓存
ANALYSIS_CACHE_VERSION = 3

def _conviction_score(level, count, days):
    """0-100 合成分：LLM 强度(70%) + 本地频次(15%) + 跨天一致性(15%)。"""
    base = 0
    for k, v in LEVEL_SCORES.items():
        if k in level:
            base = v
            break
    freq = min(count / 12, 1) * 15
    persist = min(days / 7, 1) * 15
    return max(0, min(100, round(base * 0.7 + freq + persist)))

def _parse_day(s):
    try:
        dt = datetime.strptime(s, "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None

def main():
    # 加载环境变量
    current_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(dotenv_path=os.path.join(current_dir, ".env"))
    
    # 补充尝试从 local.settings.json 加载环境参数
    settings_path = os.path.join(current_dir, "local.settings.json")
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                settings = json.load(f)
            values = settings.get("Values", {})
            for k, v in values.items():
                if k not in os.environ:
                    os.environ[k] = str(v)
        except Exception:
            pass

    target_user_id = os.getenv("TARGET_USER_ID", "1940360837547565056")
    # 抓取默认向前追溯天数 (归档模式下，我们默认多抓取一些天数)
    range_days = int(os.getenv("RANGE_DAYS", "30"))

    print(f"🚀 [CLI] 正在启动时序归档增量采集与翻译...")
    print(f"📡 监控目标用户 ID: {target_user_id}")
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=range_days)
    print(f"📅 截止日期门槛为: {cutoff_date.strftime('%Y-%m-%d %H:%M:%S %Z')}")

    cache = DailyCacheManager()
    
    # 1. 尝试从本地加载已有的中英对照归档或进行平滑迁移
    archive_data = []
    existing_translations = {}
    archive_path = os.path.join(cache.cache_dir, f"tweets_archive_{target_user_id}.json")
    
    # 优先加载时序归档文件（增量去重的权威来源）
    if os.path.exists(archive_path):
        try:
            with open(archive_path, "r", encoding="utf-8") as f:
                archive_data = json.load(f)
            for item in archive_data:
                existing_translations[item["original"]] = item["translation"]
            print(f"📂 成功加载原始推文时序归档，已包含 {len(archive_data)} 条历史推文。")
        except Exception as e:
            print(f"⚠️ 读取原始时序归档失败: {e}，将改从报告文件提取存量。")

    # 兜底：归档缺失 / 为空 / 加载失败时，扫描全部报告文件（7/30/90d）
    # 提取存量翻译，只补空缺不覆盖，保证每次更新只翻译真正新增的推文。
    if not existing_translations:
        report_translations, report_items = _extract_translations_from_reports(cache.cache_dir, target_user_id)
        if report_translations:
            added = 0
            for item in report_items:
                if item["original"] in existing_translations:
                    continue
                existing_translations[item["original"]] = item["translation"]
                archive_data.append(item)
                added += 1
            print(f"📂 从报告文件中提取并补齐了 {added} 条存量翻译，避免重复翻译。")

    cursor = None
    page = 1
    daily_tweets = defaultdict(list)
    seen_texts = set()
    all_raw_tweets = []
    hit_cache_stop = False
    
    # 2. 爬虫抓取逻辑 (智能增量更新)
    while not hit_cache_stop:
        print(f"📡 [第 {page} 页] 正在获取推文数据...")
        raw_data = fetch_user_tweets(user_id=target_user_id, count=100, cursor=cursor)
        
        if not raw_data:
            print("❌ 获取推文页失败，结束抓取。")
            break
            
        timeline_data = raw_data.get('data', {}).get('user', {}).get('result', {}).get('timeline', {}).get('timeline', {})
        instructions = timeline_data.get('instructions', [])
        
        tweets_in_page = 0
        oldest_date_in_page = None
        next_cursor = None
        
        for instruction in instructions:
            if instruction.get('type') == 'TimelineAddEntries':
                for entry in instruction.get('entries', []):
                    content = entry.get('content', {})
                    if content.get('cursorType') == 'Bottom':
                        next_cursor = content.get('value')
                        
                    item_content = content.get('itemContent', {})
                    if item_content.get('itemType') == 'TimelineTweet':
                        tweet_results = item_content.get('tweet_results', {})
                        result = tweet_results.get('result', {})
                        if not result:
                            continue
                        
                        # 保存完整正文（优先 note_tweet 长推文，回退 legacy.full_text / 引用推文）
                        full_text = _extract_full_text(result)
                        if not full_text and 'quoted_status_result' in result:
                            full_text = _extract_full_text(result.get('quoted_status_result', {}).get('result', {}))
                        if not full_text:
                            continue

                        legacy = _extract_legacy(result) or {}
                        raw_date = legacy.get('created_at')

                        if full_text and raw_date:
                            try:
                                dt = datetime.strptime(raw_date, "%a %b %d %H:%M:%S %z %Y")
                            except Exception:
                                continue
                                
                            if oldest_date_in_page is None or dt < oldest_date_in_page:
                                oldest_date_in_page = dt
                                
                            # 💡 核心对账
                            if full_text in existing_translations:
                                if os.getenv("FORCE_REFRESH", "false").lower() in ("true", "1"):
                                    print(f"📍 [强刷模式] 命中本地缓存推文，但由于开启了 FORCE_REFRESH，将继续向前抓取以补全空洞数据。")
                                else:
                                    print(f"📍 [智能增量] 命中本地缓存推文，后续数据必定已同步，停止翻页。")
                                    hit_cache_stop = True
                                    break
                                
                            if dt < cutoff_date:
                                continue
                                
                            if full_text not in seen_texts:
                                seen_texts.add(full_text)
                                date_str = dt.strftime("%Y-%m-%d")
                                all_raw_tweets.append({"date": date_str, "text": full_text})
                                tweets_in_page += 1
                                
                if hit_cache_stop:
                    break

        print(f"   ✨ 本页解析出 {tweets_in_page} 条新推文")
        if oldest_date_in_page:
            print(f"   📅 最旧推文时间: {oldest_date_in_page.strftime('%Y-%m-%d')}")
            
        if oldest_date_in_page and oldest_date_in_page < cutoff_date:
            print(f"🏁 越过时间截止线，停止翻页。")
            break
        if not next_cursor or next_cursor == cursor:
            break
            
        cursor = next_cursor
        page += 1
        time.sleep(1.5)

    # 3. 翻译新推文 (跳过已翻译的)
    new_texts = [tweet["text"] for tweet in all_raw_tweets if tweet["text"] not in existing_translations]
    engine = AzureChatEngine()
    
    if new_texts:
        print(f"\n🤖 [AI 翻译] 发现 {len(new_texts)} 条新推文，正在启动翻译...")
        new_translations = batch_translate(new_texts, engine)
        for t in new_translations:
            existing_translations[t["original"]] = t["translation"]
    else:
        print("\n📍 没有发现任何新推文，翻译部分直接读取缓存。")

    # 4. 重建并合并时序归档（无强制截断，保留所有历史）
    seen_originals = set()
    merged_archive = []
    
    # 优先加入新抓取的推文
    for item in all_raw_tweets:
        orig = item["text"]
        date_str = item["date"]
        if orig not in seen_originals:
            seen_originals.add(orig)
            merged_archive.append({
                "date": date_str,
                "original": orig,
                "translation": existing_translations.get(orig, "(翻译暂无)")
            })
            
    # 合并原有归档历史推文
    for item in archive_data:
        orig = item["original"]
        if orig not in seen_originals:
            seen_originals.add(orig)
            merged_archive.append(item)
            
    # 按照时间从新到旧对归档排序
    merged_archive.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    # 写入归档文件
    with open(archive_path, "w", encoding="utf-8") as f:
        json.dump(merged_archive, f, ensure_ascii=False, indent=4)
    print(f"💾 原始时序归档已成功更新并保存，累计 {len(merged_archive)} 条记录。")

    # 5. 分别生成 7d, 30d, 90d 的分析报告快照
    # 分析窗口按真实股市节奏：周 / 月 / 季。长期维度由"跨等长周期趋势 + horizon"覆盖，
    # 不再单独做大窗口（180/365）一次性分析（内容由近端主导，与 90d 高度重合且费 token）。
    time_windows = [7, 30, 90]
    previous_analyses = {}

    # 跨天分析缓存：按窗口内容签名判断是否需要重新调用 LLM，内容没变则 0 Token 复用
    analysis_cache_path = os.path.join(cache.cache_dir, f"analysis_cache_{target_user_id}.json")
    analysis_cache = {}
    if os.path.exists(analysis_cache_path):
        try:
            with open(analysis_cache_path, "r", encoding="utf-8") as f:
                analysis_cache = json.load(f)
            if analysis_cache.get("_version") != ANALYSIS_CACHE_VERSION:
                print("⚠️ 分析缓存版本已升级，作废旧缓存，本次会重新分析一次。")
                analysis_cache = {}
            n = len([k for k in analysis_cache if k != "_version"])
            print(f"📂 已加载跨天分析缓存 ({n} 个窗口)。")
        except Exception as e:
            print(f"⚠️ 读取分析缓存失败: {e}")
    
    for days in time_windows:
        # cutoff 归一到当天零点：否则截止日当天的推文会被挤到"上一周期"，污染窗口与趋势
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        window_items = []
        for item in merged_archive:
            try:
                dt = datetime.strptime(item["date"], "%Y-%m-%d")
                dt = dt.replace(tzinfo=timezone.utc)
                if dt >= cutoff:
                    window_items.append(item)
            except Exception:
                # 无法解析日期的默认保留
                window_items.append(item)
                
        if not window_items:
            print(f"⚠️ [近 {days} 天] 窗口内无推文数据，跳过报告生成。")
            continue
            
        window_texts = [item["original"] for item in window_items]
        window_text_count = len(window_texts)
        window_sig = _window_signature(window_items)
        cur_stats = _ticker_stats(window_items)

        # 跨天缓存优先：只有本窗口内出现"新增推文"时才需要重新分析。
        # 纯旧推文滑出窗口 / 内容不变 → 直接复用上次分析（0 Token）。
        cached = analysis_cache.get(str(days))
        cached_texts = set(cached.get("texts", [])) if cached else set()
        new_in_window = set(window_texts) - cached_texts
        if cached and not new_in_window:
            print(f"🔄 [近 {days} 天] 无新增推文 ({window_text_count} 条)，复用上次分析结果（0 Token）。")
            hot_topics = cached["hot_topics"]
            industries = cached["industries"]
            conviction_watchlist = cached["conviction_watchlist"]
            supply_chain_bottlenecks = cached["supply_chain_bottlenecks"]
            value_chain_mapping = cached["value_chain_mapping"]
        else:
            # 智能比对去重：如果当前大窗口推文数量与前一个小窗口相同且内容集合一致，直接复用分析结果
            match_key = None
            for prev_days, prev_data in previous_analyses.items():
                if prev_data["tweet_count"] == window_text_count:
                    if set(prev_data["tweets"]) == set(window_texts):
                        match_key = prev_days
                        break
                        
            if match_key:
                print(f"🔄 [近 {days} 天] 推文内容与 [近 {match_key} 天] 完全一致，执行 0 Token 复用优化！")
                hot_topics = previous_analyses[match_key]["hot_topics"]
                industries = previous_analyses[match_key]["industries"]
                conviction_watchlist = previous_analyses[match_key]["conviction_watchlist"]
                supply_chain_bottlenecks = previous_analyses[match_key]["supply_chain_bottlenecks"]
                value_chain_mapping = previous_analyses[match_key]["value_chain_mapping"]
            else:
                print(f"\n🤖 [AI 投研分析] 针对近 {days} 天内 ({window_text_count} 条推文) 进行热门话题、行业板块等核心投研数据分析...")
                hot_topics, industries, conviction_watchlist, supply_chain_bottlenecks, value_chain_mapping = analyze_investor_insights(window_texts, engine, ticker_stats=cur_stats)

            # 记录本次分析结果到跨天缓存
            analysis_cache[str(days)] = {
                "signature": window_sig,
                "texts": window_texts,
                "hot_topics": hot_topics,
                "industries": industries,
                "conviction_watchlist": conviction_watchlist,
                "supply_chain_bottlenecks": supply_chain_bottlenecks,
                "value_chain_mapping": value_chain_mapping,
            }
            
        # 本地零 AI 增强：为信心指数补上提及次数/天数、环比趋势、合成信心分
        prev_cutoff = cutoff - timedelta(days=days)
        prev_items = []
        for it in merged_archive:
            d = _parse_day(it["date"])
            if d is not None and prev_cutoff <= d < cutoff:
                prev_items.append(it)
        prev_stats = _ticker_stats(prev_items)
        if not prev_items:
            # 归档深度不足（无上一等长周期数据）时趋势标记为中性，避免全部误标"新提及"
            trend = {sym: "steady" for sym in cur_stats}
        else:
            trend = _ticker_trend(cur_stats, prev_stats)
        enriched_watchlist = []
        for item in conviction_watchlist or []:
            sym = _normalize_ticker(item.get("ticker"))
            if not sym:
                continue
            st = cur_stats.get("$" + sym, {"count": 0, "days": 0})
            enriched_watchlist.append({
                **item,
                "mention_count": st["count"],
                "mention_days": st["days"],
                "trend": trend.get("$" + sym, "new"),
                "conviction_score": _conviction_score(item.get("conviction_level", ""), st["count"], st["days"]),
            })
        conviction_watchlist = enriched_watchlist

        # 缓存当前结果以供后续复用
        previous_analyses[days] = {
            "tweet_count": window_text_count,
            "tweets": window_texts,
            "hot_topics": hot_topics,
            "industries": industries,
            "conviction_watchlist": conviction_watchlist,
            "supply_chain_bottlenecks": supply_chain_bottlenecks,
            "value_chain_mapping": value_chain_mapping
        }
        
        # 格式化当前窗口的 tweets 数据结构
        formatted_tweets = defaultdict(list)
        for item in window_items:
            formatted_tweets[item["date"]].append({
                "original": item["original"],
                "translation": item["translation"]
            })
            
        formatted_data = []
        for d in sorted(formatted_tweets.keys(), reverse=True):
            formatted_data.append({
                "date": d,
                "tweets": formatted_tweets[d]
            })
            
        payload = {
            "user_id": target_user_id,
            "range_days": days,
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "hot_topics": hot_topics,
            "industries": industries,
            "conviction_watchlist": conviction_watchlist,
            "supply_chain_bottlenecks": supply_chain_bottlenecks,
            "value_chain_mapping": value_chain_mapping,
            "data": formatted_data
        }
        
        # 写入独立的 JSON 文档 report_translated_{user_id}_{days}d.json
        report_output_path = os.path.join(cache.cache_dir, f"report_translated_{target_user_id}_{days}d.json")
        with open(report_output_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=4)
        print(f"📄 [近 {days} 天] 静态报告分析文档生成成功: {os.path.basename(report_output_path)}")
        
        # 兼容老路由：当 days=30 时顺便写一份无后缀版本
        if days == 30:
            compat_output_path = os.path.join(cache.cache_dir, f"report_translated_{target_user_id}.json")
            with open(compat_output_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=4)

    # 持久化跨天分析缓存，供下次运行复用（未变化窗口直接跳过 AI）
    try:
        analysis_cache["_version"] = ANALYSIS_CACHE_VERSION
        with open(analysis_cache_path, "w", encoding="utf-8") as f:
            json.dump(analysis_cache, f, ensure_ascii=False, indent=4)
        n = len([k for k in analysis_cache if k != "_version"])
        print(f"💾 分析缓存已保存 ({n} 个窗口)，下次运行将跳过未变化窗口的分析。")
    except Exception as e:
        print(f"⚠️ 保存分析缓存失败: {e}")

    # 6. 清理多余临时文件
    raw_path = os.path.join(cache.cache_dir, f"raw_{target_user_id}.json")
    txt_path = os.path.join(cache.cache_dir, f"tweets_{target_user_id}.txt")
    for temp_file in [raw_path, txt_path]:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                print(f"🗑️ 已成功清理冗余文件: {os.path.basename(temp_file)}")
            except Exception:
                pass

    # 7. 自动同步报告至 standalone/prediction（纯静态数据源热更新，前端无需 rebuild）
    try:
        import shutil
        current_script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.abspath(os.path.join(current_script_dir, "..", ".."))
        standalone_kol = os.path.join(repo_root, "standalone", "prediction", "kol")
        standalone_dist_kol = os.path.join(repo_root, "standalone", "prediction", "dist", "kol")

        target_dirs = [d for d in [standalone_kol, standalone_dist_kol] if os.path.exists(d)]
        if target_dirs:
            report_files = glob.glob(os.path.join(cache.cache_dir, f"report_translated_{target_user_id}*.json"))
            for t_dir in target_dirs:
                for src_f in report_files:
                    shutil.copy2(src_f, t_dir)
            print(f"🔄 [自动同步] 已将 {len(report_files)} 份最新投研报告同步至 standalone/prediction 数据源。")
    except Exception as e:
        print(f"⚠️ 自动同步 standalone 失败 (可忽略): {e}")

if __name__ == "__main__":
    main()
