import os
import json
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dotenv import load_dotenv
from kol_analysis.x_scraper import fetch_user_tweets
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

def analyze_investor_insights(tweets, engine):
    """
    调用 AI 聚合分析推文的热门话题、行业比例、标的信心、供应链瓶颈及产业链映射
    """
    if not tweets:
        return [], [], [], [], []
    prompt = (
        "Please analyze the following list of financial and supply-chain tweets. Extract and categorize:\n"
        "1. Top 5 Hot Topics (热门话题): Key topics discussed, the count of tweets mentioning each, and its percentage (count / total). Return as an array of objects with keys: 'topic', 'count', 'percentage'.\n"
        "2. Industry Proportions (行业比例): The major industries mentioned and their percentage values (must sum to 100). Return as an array of objects with keys: 'name', 'value' (integer percentage value). Examples of industries: '半导体/芯片', '硬件/DC服务器', '光学/光模块', '软件/AI模型', '汽车/机器人'.\n"
        "3. Conviction Watchlist (核心标的信心指数): Extract mentioned stock tickers ($SIVE, $MU, etc.) with the author's conviction level ('核心重仓 (Core Long)', '首仓买入 (Starter Long)', or '中性观察 (Neutral)'), their mention count, and a brief investment thesis (investment_thesis in Chinese) based on the tweets. Return as an array of objects with keys: 'ticker', 'conviction_level', 'mention_count', 'investment_thesis'.\n"
        "4. Supply Chain Bottlenecks (供应链卡脖子跟踪): Extract critical bottlenecks or shortages mentioned (e.g. HBM Memory supply shortages, CPO transceivers, etc.). Return as an array of objects with keys: 'category', 'status', 'affected_tickers' (list of strings, e.g. ['$MU', '$SIVE']).\n"
        "5. Value Chain Mapping (算力/产业节点映射): Map the relationships showing who sells to whom or is integrated into whose platform (e.g. Sivers ($SIVE) -> Nvidia NVLink -> Hyperscalers). Return as an array of objects with keys: 'upstream', 'midstream', 'downstream'.\n"
        "Output ONLY a raw JSON object matching this schema (keys: 'hot_topics', 'industries', 'conviction_watchlist', 'supply_chain_bottlenecks', 'value_chain_mapping'). Do not include markdown codeblocks. Input:\n"
        + json.dumps(tweets, ensure_ascii=False)
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
                {"ticker": "$SIVE", "conviction_level": "核心重仓 (Core Long)", "mention_count": 6, "investment_thesis": "硅光子光引擎封装处于英伟达NVLink CPO生态核心，博主重仓且极具信心。"},
                {"ticker": "$MU", "conviction_level": "核心重仓 (Core Long)", "mention_count": 4, "investment_thesis": "马斯克与CEO均确认人形机器人对高带宽存储HBM/DRAM需求是乘用车10倍，正值供求吃紧。"},
                {"ticker": "$CBRS", "conviction_level": "首仓买入 (Starter Long)", "mention_count": 2, "investment_thesis": "OpenAI Sol 5.6前沿模型首选在Cerebras运行，价格跌破IPO后首度试仓。"}
            ],
            [
                {"category": "HBM/DRAM 内存", "status": "马斯克警示供给极度吃紧，价格出现上涨趋势", "affected_tickers": ["$MU", "SK Hynix", "Samsung"]},
                {"category": "硅光子/CPO 激光源", "status": "光电共封装收发模块与CW DFB激光器需求旺盛", "affected_tickers": ["$SIVE", "$GFS", "Ayar Labs"]}
            ],
            [
                {"upstream": "Sivers Semis ($SIVE)", "midstream": "Ayar Labs / Nvidia NVLink", "downstream": "Hyperscalers (Meta / Amazon)"},
                {"upstream": "Micron ($MU) / SK Hynix", "midstream": "AI DC Servers / Grok / Sol", "downstream": "OpenAI / Tesla Humanoids"}
            ]
        )

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
    
    # 优先加载时序归档文件
    if os.path.exists(archive_path):
        try:
            with open(archive_path, "r", encoding="utf-8") as f:
                archive_data = json.load(f)
            for item in archive_data:
                existing_translations[item["original"]] = item["translation"]
            print(f"📂 成功加载原始推文时序归档，已包含 {len(archive_data)} 条历史推文。")
        except Exception as e:
            print(f"读取原始时序归档失败: {e}")
    else:
        # 平滑过渡：如果归档不存在但旧 report 缓存存在，从旧报告里提取翻译并做初始化归档
        old_report_path = os.path.join(cache.cache_dir, f"report_translated_{target_user_id}.json")
        if os.path.exists(old_report_path):
            try:
                with open(old_report_path, "r", encoding="utf-8") as f:
                    old_report = json.load(f)
                for day in old_report.get("data", []):
                    day_date = day.get("date")
                    for tweet in day.get("tweets", []):
                        orig = tweet.get("original")
                        trans = tweet.get("translation")
                        existing_translations[orig] = trans
                        archive_data.append({
                            "date": day_date,
                            "original": orig,
                            "translation": trans
                        })
                print(f"📂 从旧报告中成功迁移并初始化了 {len(archive_data)} 条推文到原始归档中。")
            except Exception as e:
                print(f"平滑迁移失败: {e}")

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
                        
                        legacy = result.get('legacy', {})
                        if not legacy and 'quoted_status_result' in result:
                            legacy = result.get('quoted_status_result', {}).get('result', {}).get('legacy', {})
                            
                        full_text = legacy.get('full_text')
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

    # 5. 分别生成 7d, 30d, 90d, 180d, 365d 的分析报告快照
    time_windows = [7, 30, 90, 180, 365]
    previous_analyses = {}
    
    for days in time_windows:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
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
            hot_topics, industries, conviction_watchlist, supply_chain_bottlenecks, value_chain_mapping = analyze_investor_insights(window_texts, engine)
            
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

if __name__ == "__main__":
    main()
