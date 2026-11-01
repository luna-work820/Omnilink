# C 端成分资料索引

`ingredient-index.json` 由 `scripts/build-consumer-ingredient-index.py` 从用户提供的 `personal-advisor-data-sources-2026-10-15.zip` 生成。

- BEAUTEE Cosmetic Ingredients Dataset (Lite)：INCI 名称和 CosIng、CAS、EC、PubChem 标识。Copyright (c) 2025 BEAUTEE，MIT License；来源：[BEAUTEE](https://beautee.ru/)。完整授权文本见 `BEAUTEE-LICENSE`。
- Open Beauty Facts 仓库 `cosing/`：2016 年的 Ingredients/Fragrance Inventory 中的功能字段，以及仓库中的 Annex II–VI 表。这里只保留按 INCI 名称或 CAS 精确关联的历史索引字段；来源：[Open Beauty Facts](https://github.com/openfoodfacts/openbeautyfacts/tree/develop/cosing)。这些快照不代表现行法规。

索引不含产品配料表、肤质适配结论、个人禁忌或安全评分。历史 Annex 关联仅用于提示进一步核对，不可直接断言产品合法性或成分风险。重新生成时运行 `python3 scripts/build-consumer-ingredient-index.py /path/to/source.zip`。
