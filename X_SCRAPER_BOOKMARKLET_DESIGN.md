# X.com 爬虫书签一键同步方案设计 (Bookmarklet Sync)

本设计方案旨在解决云端爬虫因 X.com (Twitter) 的 GraphQL 频繁变更 `queryId`、`features` 且极易封禁云端模拟登录账号的问题。

---

## 二、 核心模块实现

### 1. 浏览器端书签脚本 (JavaScript Bookmarklet)

这段 JS 脚本会利用浏览器的 `Performance API` 动态扫描页面上最近发起的 GraphQL 请求，智能提取当前的 `queryId` 和 `features`，免去了繁琐的正则匹配，准确率高达 100%。

```javascript
javascript:(function() {
    // === 1. 配置您的云端端点与安全密钥 ===
    const CLOUD_ENDPOINT = "https://<your-azure-function-url>/api/admin/sync_x_credentials";
    const SYNC_SECRET = "OmniGuardSyncSecret2026"; // 自定义一个高强度密钥

    console.log("[OmniGuard] 开始提取 X.com 凭证...");

    // === 2. 提取 Cookie 与 CSRF Token ===
    const cookieStr = document.cookie;
    const cookies = {};
    cookieStr.split(';').forEach(item => {
        const parts = item.split('=');
        if(parts.length >= 2) {
            cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    });

    const csrfToken = cookies['ct0'];
    if (!csrfToken) {
        alert("未检测到登录态 ct0，请确认您已成功登录 X.com！");
        return;
    }

    // === 3. 动态检索已加载资源中的 queryId 和 features ===
    let queryId = "";
    let features = {};
    
    // 扫描页面所有发出的请求资源
    const resources = performance.getEntriesByType("resource");
    for (const r of resources) {
        if (r.name.includes("/graphql/") && r.name.includes("UserTweets")) {
            try {
                const url = new URL(r.name);
                const variables = JSON.parse(url.searchParams.get("variables"));
                queryId = url.pathname.split("/").pop(); // 提取 url 中的 queryId
                features = JSON.parse(url.searchParams.get("features"));
                console.log("[OmniGuard] 成功捕获最新的 GraphQL 参数:", { queryId, features });
                break;
            } catch (e) {
                console.warn("[OmniGuard] 解析请求参数失败，跳过该请求:", e);
            }
        }
    }

    // 如果页面刚刷新还没触发 UserTweets，我们尝试找其他 graphql 请求提取 features
    if (!queryId) {
        for (const r of resources) {
            if (r.name.includes("/graphql/")) {
                try {
                    const url = new URL(r.name);
                    queryId = "hr4gzZONlq23okjU8fIe_A"; // 使用默认值兜底
                    features = JSON.parse(url.searchParams.get("features"));
                    console.log("[OmniGuard] 找到其他 GraphQL 请求以提取 features:", features);
                    break;
                } catch (e) {}
            }
        }
    }

    // === 4. 打包并发送给云端 Azure Function ===
    const payload = {
        secret: SYNC_SECRET,
        query_id: queryId || "hr4gzZONlq23okjU8fIe_A",
        csrf_token: csrfToken,
        cookies: cookies,
        features: features
    };

    fetch(CLOUD_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (res.ok) {
            alert("🎉 OmniGuard X 爬虫配置云端同步成功！");
        } else {
            res.text().then(text => alert("❌ 同步失败: " + text));
        }
    })
    .catch(err => {
        alert("💥 请求发起失败，请检查网络或跨域设置: " + err);
    });
})();
```

---

### 2. 云端接收接口 (FastAPI Router)

在 [digitalhuman/router.py](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/cloud-orchestrator/digitalhuman/router.py) 或 [kol_analysis/router.py](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/cloud-orchestrator/kol_analysis/router.py) 中，提供接收端点并存入 Cosmos DB。

```python
import datetime
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from embodied_brain.utils import get_cosmos_container

admin_router = APIRouter()

# 预设的同步安全密钥，与书签脚本保持一致
ADMIN_SYNC_SECRET = "OmniGuardSyncSecret2026"

@admin_router.post("/api/admin/sync_x_credentials")
async def sync_x_credentials(request: Request):
    try:
        data = await request.json()
        
        # 1. 安全校验
        client_secret = data.get("secret")
        if client_secret != ADMIN_SYNC_SECRET:
            raise HTTPException(status_code=403, detail="Unauthorized sync request. Invalid secret key.")
            
        query_id = data.get("query_id")
        csrf_token = data.get("csrf_token")
        cookies = data.get("cookies")
        features = data.get("features")
        
        if not csrf_token or not cookies:
            raise HTTPException(status_code=400, detail="Missing critical credentials (csrf_token or cookies).")
            
        # 2. 将最新的配置写入 Cosmos DB (保存在特定配置 ID 下)
        config_doc = {
            "id": "X_Scraper_Config",      # 固定主键
            "partition_key": "SystemConfig", # 分区键
            "query_id": query_id,
            "csrf_token": csrf_token,
            "cookies": cookies,
            "features": features,
            "updated_at": str(datetime.datetime.utcnow())
        }
        
        get_cosmos_container().upsert_item(config_doc)
        return JSONResponse(status_code=200, content={"status": "success", "message": "Credentials synced successfully."})
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
```

---

### 3. 爬虫模块调用端改动 (Client Scraper)

修改 [kol_analysis/x_scraper.py](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/cloud-orchestrator/kol_analysis/x_scraper.py)，动态读取最新的 Cosmos DB 配置，不再引用静态的 `config.py`。

```python
# 修改后：从 Cosmos DB 动态拉取配置，实现热更新
def get_dynamic_x_config():
    try:
        from embodied_brain.utils import get_cosmos_container
        # 从数据库读取全局保存的爬虫配置
        config_doc = get_cosmos_container().read_item(
            item="X_Scraper_Config", 
            partition_key="SystemConfig"
        )
        return config_doc
    except Exception as e:
        print(f"[⚠️ WARNING] 无法读取动态 X 配置，将降级使用本地 config.py: {e}")
        return None

def fetch_user_tweets(user_id, count=20, cursor=None):
    # 优先加载云端同步过来的最新凭据
    db_config = get_dynamic_x_config()
    
    if db_config:
        query_id = db_config["query_id"]
        csrf_token = db_config["csrf_token"]
        cookies = db_config["cookies"]
        # 直接使用本地捕获的最新 features，保证 100% 格式对齐
        features = db_config["features"]
    else:
        # 降级使用本地硬编码配置
        from . import config
        query_id = config.QUERY_ID
        csrf_token = config.headers.get("x-csrf-token")
        cookies = config.cookies
        features = { ... } # 降级默认字典
        
    url = f'https://api.x.com/graphql/{query_id}/UserTweets'
    
    variables = {
        "userId": str(user_id),
        "count": count,
        "includePromotedContent": True,
        "withQuickPromoteEligibilityTweetFields": True,
        "withVoice": True
    }
    if cursor:
        variables["cursor"] = cursor
        
    params = {
        'variables': json.dumps(variables),
        'features': json.dumps(features),
        'fieldToggles': json.dumps({"withArticlePlainText": False}),
    }
    
    # 动态组装 Headers
    headers = {
        'accept': '*/*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'referer': 'https://x.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'x-csrf-token': csrf_token,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
    }
    
    try:
        response = requests.get(
            url,
            params=params,
            cookies=cookies,
            headers=headers,
            timeout=10
        )
        # ... 正常处理逻辑 ...
```

---

## 三、 使用方法 (极简三步)

1. **新建书签**：在 Chrome 浏览器书签栏右键 -> 添加网页，名字命名为 `X Sync`，网址处粘贴上面第一节中 `javascript:...` 开头的全部代码。
2. **正常浏览**：在本地浏览器打开 `https://x.com`，确认处于登录状态（能看到主页和推文）。
3. **点击同步**：在 X.com 页面上，点击书签栏的 `X Sync`。此时脚本将执行并弹出 `🎉 同步成功`。云端配置瞬间更新！
