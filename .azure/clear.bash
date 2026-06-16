# 1. 强拆资源组
az group delete --name omniv2-guard-isolated-rg --yes --no-wait
az deployment sub delete --name omniv2-baseline-run --no-wait

az cognitiveservices account list-deleted --query "[].{Name:name, OldRG:resourceGroup, Location:location}" --output table


az cognitiveservices account purge \
--name "omniv2-openai-q2dttqqcwfp4u" \
--location japaneast \
--resource-group "omniv2-guard-isolated-rg"

echo "========= 1. 正在全域检索所有被软删除的大模型实例 ========="
DELETED_LIST=$(az cognitiveservices account list-deleted --query "[].{name:name, rg:resourceGroup, loc:location}" -o json)

if [ "$DELETED_LIST" = "[]" ] || [ -z "$DELETED_LIST" ]; then
    echo "回收站已完全清空，无残留配额占用。"
else
    echo "抓取到以下残留资产，开始强行物理湮灭..."
    echo "$DELETED_LIST" | jq -c '.[]' | while read -r row; do
        NAME=$(echo "$row" | jq -r '.name')
        RG=$(echo "$row" | jq -r '.rg')
        LOC=$(echo "$row" | jq -r '.loc')
        echo "💥 正在物理肃清: $NAME | 区域: $LOC | 原资源组: $RG"
        az cognitiveservices account purge \
          --name "$NAME" \
          --location "$LOC" \
          --resource-group "$RG"
    done
    echo "全域物理肃清命令发射完毕。"
fi

az cognitiveservices account list-deleted