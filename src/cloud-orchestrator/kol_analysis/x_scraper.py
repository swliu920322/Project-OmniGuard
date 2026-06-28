import requests
import json
from . import config

def fetch_user_tweets(user_id, count=20, cursor=None):
    """
    根据用户 ID 查询具体的推文内容
    :param user_id: X 的用户数字 ID (字符串或数字)
    :param count: 获取的推文数量，默认 20
    :param cursor: 分页游标 (可选)
    :return: 接口返回的 JSON 数据或 None
    """
    url = f'https://api.x.com/graphql/{config.QUERY_ID}/UserTweets'

    # 1. 动态构建变量，把传入的 user_id 和 count 塞进去
    variables = {
        "userId": str(user_id),
        "count": count,
        "includePromotedContent": True,
        "withQuickPromoteEligibilityTweetFields": True,
        "withVoice": True
    }
    if cursor:
        variables["cursor"] = cursor

    # 2. X 极其严格的 features 校验，保持原样即可
    features = {
        "rweb_video_screen_enabled": False,
        "rweb_cashtags_enabled": True,
        "profile_label_improvements_pcf_label_in_post_enabled": True,
        "responsive_web_profile_redirect_enabled": False,
        "rweb_tipjar_consumption_enabled": False,
        "verified_phone_label_enabled": False,
        "creator_subscriptions_tweet_preview_api_enabled": True,
        "responsive_web_graphql_timeline_navigation_enabled": True,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
        "premium_content_api_read_enabled": False,
        "communities_web_enable_tweet_community_results_fetch": True,
        "c9s_tweet_anatomy_moderator_badge_enabled": True,
        "responsive_web_grok_analyze_button_fetch_trends_enabled": False,
        "responsive_web_grok_analyze_post_followups_enabled": False,
        "rweb_cashtags_composer_attachment_enabled": True,
        "responsive_web_jetfuel_frame": True,
        "responsive_web_grok_share_attachment_enabled": True,
        "responsive_web_grok_annotations_enabled": True,
        "articles_preview_enabled": True,
        "responsive_web_edit_tweet_api_enabled": True,
        "rweb_conversational_replies_downvote_enabled": False,
        "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
        "view_counts_everywhere_api_enabled": True,
        "longform_notetweets_consumption_enabled": True,
        "responsive_web_twitter_article_tweet_consumption_enabled": True,
        "content_disclosure_indicator_enabled": True,
        "content_disclosure_ai_generated_indicator_enabled": True,
        "responsive_web_grok_show_grok_translated_post": True,
        "responsive_web_grok_analysis_button_from_backend": True,
        "post_ctas_fetch_enabled": False,
        "freedom_of_speech_not_reach_fetch_enabled": True,
        "standardized_nudges_misinfo": True,
        "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
        "longform_notetweets_rich_text_read_enabled": True,
        "longform_notetweets_inline_media_enabled": False,
        "responsive_web_grok_image_annotation_enabled": True,
        "responsive_web_grok_imagine_annotation_enabled": True,
        "responsive_web_grok_community_note_auto_translation_is_enabled": True,
        "responsive_web_enhance_cards_enabled": False
    }

    field_toggles = {
        "withArticlePlainText": False
    }

    # 3. 将字典转换为 X 请求所需的 JSON 字符串格式
    params = {
        'variables': json.dumps(variables),
        'features': json.dumps(features),
        'fieldToggles': json.dumps(field_toggles),
    }

    # 4. 发送请求
    try:
        response = requests.get(
            url,
            params=params,
            cookies=config.cookies,
            headers=config.headers,
            timeout=10  # 加上超时保护防止程序卡死
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ 请求失败，状态码: {response.status_code}")
            print(f"错误信息: {response.text}")
            return None

    except Exception as e:
        print(f"💥 发生异常: {e}")
        return None
