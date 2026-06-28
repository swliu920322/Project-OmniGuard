import json
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Response, Query
from fastapi.responses import FileResponse
from fpdf import FPDF

kol_analysis_router = APIRouter()

@kol_analysis_router.get("/api/kol/list")
def get_kol_list():
    return [
        {"id": "1940360837547565056", "name": "Aleabitoreddit (默认标的)"}
    ]

@kol_analysis_router.get("/api/kol/report")
def get_kol_report(target_user_id: str):
    try:
        current_dir = os.path.dirname(__file__)
        report_path = os.path.join(current_dir, "..", "daily_cache", f"report_translated_{target_user_id}.json")
        if os.path.exists(report_path):
            with open(report_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return Response(content=json.dumps(data), media_type="application/json", status_code=200)
        else:
            return Response(
                content=json.dumps({"error": "No report found", "message": "暂无缓存数据，请先在终端运行 python run_analysis.py 抓取并分析。"}),
                media_type="application/json",
                status_code=404
            )
    except Exception as e:
        return Response(content=json.dumps({"error": str(e)}), media_type="application/json", status_code=500)

@kol_analysis_router.get("/api/kol/pdf")
def export_kol_pdf(target_user_id: str, range_days: int = Query(7, description="导出推文天数")):
    try:
        current_dir = os.path.dirname(__file__)
        report_path = os.path.join(current_dir, "..", "daily_cache", f"report_translated_{target_user_id}.json")
        
        if not os.path.exists(report_path):
            return Response(
                content=json.dumps({"error": "No report found", "message": "无法导出 PDF，请先运行数据更新脚本。"}),
                media_type="application/json",
                status_code=404
            )
            
        with open(report_path, "r", encoding="utf-8") as f:
            report_data = json.load(f)
            
        # 1. 查找系统可用的中文字体以支持 PDF 渲染
        font_paths = [
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/Supplemental/Songti.ttc",
            "/System/Library/Fonts/STHeiti Light.ttc",
            "/usr/share/fonts/truetype/droid/DroidSansFallback.ttf",
            "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
        ]
        
        selected_font = None
        for path in font_paths:
            if os.path.exists(path):
                selected_font = path
                break
                
        if not selected_font:
            return Response(
                content=json.dumps({"error": "Font missing", "message": "系统缺少中文字体文件，无法在服务端渲染中文 PDF。"}),
                media_type="application/json",
                status_code=400
            )

        # 2. 初始化 PDF 页面
        pdf = FPDF()
        pdf.set_margins(15, 15, 15)
        pdf.add_page()
        
        # 注册 PingFang 字体
        pdf.add_font("PingFang", style="", fname=selected_font)
        pdf.add_font("PingFang", style="B", fname=selected_font)
        
        # Header
        pdf.set_font("PingFang", "B", 16)
        pdf.cell(0, 10, f"KOL 深度投研对照报告 - {target_user_id}", ln=True, align="C")
        pdf.set_font("PingFang", "", 10)
        pdf.cell(0, 8, f"统计天数: 近 {range_days} 天  |  分析时间: {report_data.get('last_updated')}  |  数据来源: X.com", ln=True, align="C")
        pdf.ln(4)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(5)
        
        # Section A: 核心标的信心指数
        watchlist = report_data.get("conviction_watchlist", [])
        if watchlist:
            pdf.set_font("PingFang", "B", 12)
            pdf.cell(0, 8, "一、 博主核心关注标的信心指数 (Conviction Watchlist)", ln=True)
            pdf.ln(2)
            for idx, stock in enumerate(watchlist):
                pdf.set_font("PingFang", "B", 9)
                pdf.cell(0, 6, f"{idx+1}. Ticker: {stock.get('ticker')}  |  信心评级: {stock.get('conviction_level')}  |  频次: {stock.get('mention_count')} 次", ln=True)
                pdf.set_font("PingFang", "", 9)
                # 使用 multi_cell 自动换行
                pdf.multi_cell(0, 5, f"   核心逻辑: {stock.get('investment_thesis')}")
                pdf.ln(2)
            pdf.ln(3)
            
        # Section B: 供应链卡脖子/缺货跟踪
        bottlenecks = report_data.get("supply_chain_bottlenecks", [])
        if bottlenecks:
            pdf.set_font("PingFang", "B", 12)
            pdf.cell(0, 8, "二、 供应链卡脖子/缺货跟踪 (Supply Chain Bottlenecks)", ln=True)
            pdf.ln(2)
            for idx, item in enumerate(bottlenecks):
                pdf.set_font("PingFang", "B", 9)
                tickers = item.get("affected_tickers", "")
                if isinstance(tickers, list):
                    tickers = ", ".join(tickers)
                pdf.cell(0, 6, f"{idx+1}. 紧缺品类: {item.get('category')}  |  波及标的: {tickers}", ln=True)
                pdf.set_font("PingFang", "", 9)
                pdf.multi_cell(0, 5, f"   目前状态: {item.get('status')}")
                pdf.ln(2)
            pdf.ln(3)

        # Section C: 中英对照推文时间线
        pdf.set_font("PingFang", "B", 12)
        pdf.cell(0, 8, "三、 中英双语对照推文列表 (Bilingual Tweet Timeline)", ln=True)
        pdf.ln(2)
        
        cutoff_date = datetime.now() - timedelta(days=range_days)
        
        has_tweets = False
        for day_group in report_data.get("data", []):
            try:
                day_dt = datetime.strptime(day_group.get("date"), "%Y-%m-%d")
            except Exception:
                day_dt = datetime.now()
                
            if day_dt < cutoff_date:
                continue
                
            has_tweets = True
            pdf.set_font("PingFang", "B", 10)
            pdf.cell(0, 8, f"日期: {day_group.get('date')} ({len(day_group.get('tweets', []))} 条记录)", ln=True)
            pdf.ln(1)
            
            for tweet in day_group.get("tweets", []):
                orig_text = tweet.get("original", "").strip()
                trans_text = tweet.get("translation", "").strip()
                
                # 打印原文 (英文)
                pdf.set_font("PingFang", "", 8.5)
                pdf.set_text_color(100, 116, 139) # 灰色
                pdf.multi_cell(0, 5, f"EN: {orig_text}")
                pdf.ln(1)
                
                # 打印中文翻译
                pdf.set_text_color(16, 185, 129) # 绿
                pdf.multi_cell(0, 5, f"ZH: {trans_text}")
                pdf.set_text_color(0, 0, 0) # 还原黑色
                pdf.ln(2)
            pdf.ln(3)
            
        if not has_tweets:
            pdf.set_font("PingFang", "", 9)
            pdf.cell(0, 6, "该时间范围内暂无捕获到的推文。", ln=True)
            
        # 3. 输出临时 PDF 文件并发送
        temp_pdf_path = os.path.join(current_dir, "..", "daily_cache", f"report_{target_user_id}_{range_days}d.pdf")
        pdf.output(temp_pdf_path)
        
        return FileResponse(
            path=temp_pdf_path,
            filename=f"Report_{target_user_id}_{range_days}Days.pdf",
            media_type="application/pdf"
        )
        
    except Exception as e:
        return Response(content=json.dumps({"error": str(e)}), media_type="application/json", status_code=500)
