import azure.functions as func
import json

app = func.FunctionApp(http_auth_level=func.AuthLevel.anonymous)

@app.route(route="audit")
def bicep_auditor(req: func.HttpRequest) -> func.HttpResponse:
    # 接收前端推过来的 Bicep 源码
    try:
        req_body = req.get_json()
        bicep_code = req_body.get('bicep_code', '')
    except ValueError:
        bicep_code = ''

    # 今天我们先验证中台全链路能否连通，直接返回模拟安全跑分
    mock_response = {
        "security_score": 95,
        "vulnerabilities": ["Warning: Storage public access is handled implicitly."]
    }

    return func.HttpResponse(
        json.dumps(mock_response),
        mimetype="application/json",
        status_code=200
    )