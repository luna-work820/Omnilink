#!/usr/bin/env python3
"""Checked, idempotent composition backfill for omnilink-dev.

Default is dry-run. Pass --apply to write. Only product->composition is changed;
title, price, images, store, published flag and specs are never touched.
Every payload below was transcribed from the official product page and includes
the exact printed raw text and the page URL used for verification.
"""
import json
import os
import re
import sys
import subprocess
import unicodedata
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / '.env.local'
VERIFIED_AT = '2026-11-26'
SOURCE = {
    'bha': 'https://www.paulaschoice.com/skin-perfecting-2pct-bha-liquid-exfoliant/201.html',
    'azelaic': 'https://www.paulaschoice.com/10pct-azelaic-acid-booster/775.html',
    'aniye': 'https://www.aniyerecords.com/en/mini-dress-drama?COLOR=00336',
    'zadig': 'https://zadig-et-voltaire.com/us/en/p/LWBA00001008/clutch-women-rock-clutch-lwba00001',
    'aniye-body': 'https://www.aniyerecords.com/en/body-kory?COLOR=00336',
    'aniye-bustier': 'https://www.aniyerecords.com/en/bustier-mika?COLOR=00336',
    'aniye-slip': 'https://www.aniyerecords.com/en/slip-dress-drama',
    'aniye-bao': 'https://www.aniyerecords.com/en/bao-long-dress',
    'zadig-mini': 'https://zadig-et-voltaire.com/us/en/p/LWBA03975005/bag-women-rock-nano-clutch-lwba03975',
    'zadig-deep': 'https://zadig-et-voltaire.com/us/en/p/LWBA04623011/rock-deep-dye-leather-clutch-bag-in-black-for-women',
    'zadig-metallic': 'https://zadig-et-voltaire.com/us/en/p/LWBA04591700/rock-26-metallic-leather-clutch-bag-in-gold-for-women',
    'zadig-suede': 'https://zadig-et-voltaire.com/us/en/p/LWBA04543214/brown-suede-leather-rock-clutch-bag-for-women',
    # 洗护独立站试点（2026-11-26）：来源均为官网商品页，去掉了 ?src= 追踪参数
    'jr-accelerator': 'https://joshrosebrook.com/products/hydrating-accelerator',
    'jr-vital-balm': 'https://joshrosebrook.com/products/vital-balm-cream',
    'jr-collagen': 'https://joshrosebrook.com/products/bioidentical-collagen-serum',
    'jr-toner': 'https://joshrosebrook.com/products/daily-acid-toner',
    'jr-cleanse': 'https://joshrosebrook.com/products/moisturizing-cleanser',
    'jr-c-complex': 'https://joshrosebrook.com/products/c-complex-serum',
    'jr-enzyme': 'https://joshrosebrook.com/products/active-enzyme-exfoliator',
    'jr-hairspray': 'https://joshrosebrook.com/products/hair-spray-firm-hold',
    'jr-boost': 'https://joshrosebrook.com/products/hydration-boost-concentrate',
    'et-shine': 'https://ethique.com/products/shine-shampoo-conditioner-full-size-duo-pack',
    'et-volumising': 'https://ethique.com/products/volumising-shampoo-conditioner-full-size-duo-pack',
    'et-smoothing': 'https://ethique.com/products/smoothing-shampoo-conditioner-full-size-duo-pack',
    'et-scalp': 'https://ethique.com/products/shampoo-bar-for-dry-scalp',
    'et-clarifying': 'https://ethique.com/products/clarifying-shampoo-bar',
    'et-scalp-shine': 'https://ethique.com/products/scalp-health-shine-shampoo-full-size-duo-pack',
    'et-clar-vol': 'https://ethique.com/products/clarifying-shampoo-volumising-conditioner-full-size-duo-pack',
    'et-strength': 'https://ethique.com/products/strength-volume-bundle',
    'et-curl': 'https://ethique.com/products/curl-defining-shampoo-conditioner-full-size-duo-pack',
    'pc-moisturizer': 'https://www.paulaschoice.com/pro-collagen-peptide-plumping-moisturizer/1510.html',
    'pc-cellular': 'https://www.paulaschoice.com/cellularyouth-age-disrupting-longevity-serum/225.html',
    'pc-cleanser': 'https://www.paulaschoice.com/clear-pore-normalizing-cleanser/600.html',
    'pc-retinol': 'https://www.paulaschoice.com/clinical-1pct-retinol-treatment/801.html',
    'pc-gloss': 'https://www.paulaschoice.com/pro-collagen-peptide-gloss-balm/71180.html',
    'pc-eye': 'https://www.paulaschoice.com/pro-collagen-peptide-firming-eye-serum/108.html',
}


def norm(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value).strip()).lower()


def canonical(value):
    parts = urllib.parse.urlsplit(value)
    query = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    query = [(key, val) for key, val in query if not key.startswith('utm_')
             and key not in ('src', 'gclid', 'fbclid')]
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path,
                                    urllib.parse.urlencode(sorted(query)), ''))


def items(names, labels=None):
    labels = labels or [''] * len(names)
    return [{'name': name, 'normalizedName': norm(name), 'position': i + 1,
             'sourceLabel': label} if label else
            {'name': name, 'normalizedName': norm(name), 'position': i + 1}
            for i, (name, label) in enumerate(zip(names, labels))]


def fiber_items(parts):
    """parts: list of (sourceLabel, text like '92% Polyester, 8% Elastane')."""
    result = []
    for label, text in parts:
        for raw in text.split(','):
            raw = raw.strip()
            if not raw:
                continue
            match = re.match(r'^(\d+(?:\.\d+)?\s*%)\s*(.+)$', raw)
            name = match.group(2).strip() if match else raw
            result.append({'name': name, 'normalizedName': norm(name),
                           'position': len(result) + 1, 'sourceLabel': label,
                           **({'proportion': match.group(1).replace(' ', '')} if match else {})})
    return result


def composition_from_parts(kind, status, source_key, raw, parts, region=None):
    value = {'kind': kind, 'status': status, 'items': fiber_items(parts),
             'rawText': raw, 'sourceUrl': SOURCE[source_key], 'observedAt': VERIFIED_AT}
    if status == 'verified':
        value['verifiedAt'] = VERIFIED_AT
    if region:
        value['region'] = region
    return value


def composition(kind, status, source_key, raw, names, labels=None, region=None):
    value = {'kind': kind, 'status': status,
             'items': items(items_clean(names), labels), 'rawText': raw,
             'sourceUrl': SOURCE[source_key], 'observedAt': VERIFIED_AT}
    if status == 'verified':
        value['verifiedAt'] = VERIFIED_AT
    if region:
        value['region'] = region
    return value


def items_clean(names):
    """Strip decorative markers from printed INCI names while rawText keeps them.

    Removes leading certification marks (* † § | ‡) and trailing footnote digits
    (e.g. 'Limonene²'). Never alters the ingredient term itself.
    """
    cleaned = []
    for n in names:
        value = re.sub(r'^[*\u2020\u00a7\u201c\u201d|]+\s*', '', n.strip())
        value = re.sub(r'[\u00b9\u00b2\u00b3\u0302\u00b0]+$', '', value).strip()
        cleaned.append(value)
    return cleaned


def inci_items(raw):
    """Split a printed INCI string on commas that separate ingredients.

    Protects:
      - parentheses: 'Iron Oxides (CI 77492, CI 77491)'
      - slashes: 'Aqua/Water/Eau'
      - numeric locants after a comma: '1, 2-Hexanediol' and '1,2-Hexanediol'
    """
    result, buf, depth = [], '', 0
    i = 0
    while i < len(raw):
        ch = raw[i]
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        if ch == ',' and depth == 0:
            tail = raw[i + 1:]
            # A comma followed by a numeric locant is not a separator.
            # e.g. "1, 2-Hexanediol" / "1,2-Hexanediol" (INCI positional numbering).
            # Only a locant continuation: buffer ends in a digit AND tail starts
            # with digit+hyphen. This protects "1,2-Hexanediol" / "1, 2-Hexanediol"
            # but not a real ingredient like "Seed Oil, 3-O-Ethyl-Ascorbic Acid".
            if re.search(r'\d$', buf) and re.match(r'^\s*\d+\s*[-–]\s*[A-Za-z]', tail):
                buf += ch
                i += 1
                continue
            if buf.strip():
                result.append(buf.strip())
            buf = ''
        else:
            buf += ch
        i += 1
    if buf.strip():
        result.append(buf.strip())
    return items_clean(result)


def inci_composition(status, source_key, raw, region=None, parts=None):
    """Cosmetic INCI payload. Single list -> items from raw; multi-part bundles
    supply parts=[(sourceLabel, inci_text), ...] whose items are concatenated.
    """
    if parts:
        built = []
        for label, text in parts:
            for name in inci_items(text):
                built.append({'name': name, 'normalizedName': norm(name),
                              'sourceLabel': label})
        for i, entry in enumerate(built):
            entry['position'] = i + 1
        item_list = built
    else:
        item_list = items(inci_items(raw))
    value = {'kind': 'cosmetic-inci', 'status': status, 'items': item_list,
             'rawText': raw, 'sourceUrl': SOURCE[source_key], 'observedAt': VERIFIED_AT}
    if status == 'verified':
        value['verifiedAt'] = VERIFIED_AT
    if region:
        value['region'] = region
    return value


BHA_RAW = 'Water, Methylpropanediol, Butylene Glycol, Salicylic Acid, Polysorbate 20, Camellia Oleifera, Sodium Hydroxide, Tetrasodium EDTA'
AZELAIC_RAW = ('Water, Azelaic Acid, C12-15 Alkyl Benzoate, Caprylic/Capric Triglyceride, '
               'Methyl Glucose Sesquistearate, Glycerin, Cetearyl Alcohol, Glyceryl Stearate, Dimethicone, '
               'Salicylic Acid, Adenosine, Glycyrrhiza Glabra (Licorice) Root Extract, '
               'Boerhavia Diffusa Root Extract, Allantoin, Bisabolol, Cyclopentasiloxane, Xanthan Gum, '
               'Sclerotium Gum, Propanediol, Butylene Glycol, Phenoxyethanol')
ANIYE_RAW = ('1 Fabric: 100% Viscose 2 Fabric: 77% Polyamide, 23% Elastane '
             'Detail: 100% Polyamide Petticoat: 100% Polyester')
ZADIG_RAW = 'Material: 100% Cow leather\nLining: 100% Cotton*\n*Recycled cotton fibers'

PAYLOADS = {
    'tbp-paulas-choice-1': composition('cosmetic-inci', 'verified', 'bha', BHA_RAW, BHA_RAW.split(', '), region='US'),
    'tbp-paulas-choice-4': composition('cosmetic-inci', 'verified', 'azelaic', AZELAIC_RAW, AZELAIC_RAW.split(', '), region='US'),
    'bp-aniye-records-1': composition('textile-fiber', 'partial', 'aniye', ANIYE_RAW,
        ['Viscose', 'Polyamide', 'Elastane', 'Polyamide', 'Polyester'],
        ['1 Fabric', '2 Fabric', '2 Fabric', 'Detail', 'Petticoat']),
    'bp-zadig-voltaire-1': composition('textile-fiber', 'verified', 'zadig', ZADIG_RAW,
        ['Cow leather', 'Cotton*'], ['Material', 'Lining']),
    'bp-aniye-records-2': composition_from_parts('textile-fiber', 'partial', 'aniye-body',
        'Composition: Cape: 92% Polyester, 8% Elastane', [('Cape', '92% Polyester, 8% Elastane')]),
    'bp-aniye-records-3': composition_from_parts('textile-fiber', 'partial', 'aniye-bustier',
        'Composition: Garment: 100% Polyester Lining: 82% Polyamide, 18% Elastane',
        [('Garment', '100% Polyester'), ('Lining', '82% Polyamide, 18% Elastane')]),
    'bp-aniye-records-4': composition_from_parts('textile-fiber', 'partial', 'aniye-slip',
        'Composition: 1 Fabric: 100% Viscose 2 Fabric: 100% Viscose Lining: 100% Polyester',
        [('1 Fabric', '100% Viscose'), ('2 Fabric', '100% Viscose'), ('Lining', '100% Polyester')]),
    'external-8f21fd63f993c31baa4df1cf': composition_from_parts('textile-fiber', 'partial', 'aniye-bao',
        'Composition: Cape: 94% Polyester, 6% Elastane Lining: 100% Polyester',
        [('Cape', '94% Polyester, 6% Elastane'), ('Lining', '100% Polyester')]),
    'bp-zadig-voltaire-2': composition_from_parts('textile-fiber', 'verified', 'zadig-mini', ZADIG_RAW,
        [('Material', '100% Cow leather'), ('Lining', '100% Cotton*')]),
    'bp-zadig-voltaire-3': composition_from_parts('textile-fiber', 'verified', 'zadig-deep', ZADIG_RAW,
        [('Material', '100% Cow leather'), ('Lining', '100% Cotton*')]),
    'bp-zadig-voltaire-4': composition_from_parts('textile-fiber', 'verified', 'zadig-metallic', ZADIG_RAW,
        [('Material', '100% Cow leather'), ('Lining', '100% Cotton*')]),
    'bp-zadig-voltaire-5': composition_from_parts('textile-fiber', 'verified', 'zadig-suede',
        'Material: 100% Cow crust\nSecondary material: 100% Cow leather\nLining: 50% Cotton* 50% Cotton\n*Recycled cotton fibers',
        [('Material', '100% Cow crust'), ('Secondary material', '100% Cow leather'), ('Lining', '50% Cotton*, 50% Cotton')]),
    # ===== 洗护独立站试点（2026-11-26，官网原文，商品名逐一核对一致） =====
    'tbp-josh-rose-1': inci_composition('verified', 'jr-accelerator',
        '*Aloe Vera Leaf Juice, *Jojoba Seed Oil, \u2020Marula Seed Oil, *Vitamin E, *Evening Primrose Oil, *Grape Seed Oil, *Sea Buckthorn Oil, *Hemp Seed Oil, *Borage Seed Oil, *Almond Oil, *Sesame Seed Oil, *Goji Berry Fruit Extract, *Ashwagandha Leaf Extract, *Turmeric Leaf Extract, *Calendula Extract, *Black Cohosh Root Extract, *Dandelion Extract, *Fo-Ti Root Extract, *Alfalfa Extract, *Bilberry Fruit Extract, *Rosemary Extract, *Elderberry Extract, *Raspberry Fruit Extract, *Burdock Root Extract, *Chamomile Extract, *Rose Flower Powder, *Eyebright Extract, *Beet Extract, *St. John\u2019s Wort Extract, *Hawthorn Berry Fruit Extract, *Chickweed Extract, *Licorice Root Extract, *Coriander Extract, *Horse Chestnut Extract, *Lavender Extract, *Red Clover Extract, *Olive Leaf Extract, *Sage Extract, *Thyme Extract, *Vanilla Bean Extract, \u2020Ylang Ylang Flower Oil, \u2020Rosemary Leaf Oil, \u2020Eucalyptus Leaf Oil, \u2020Bergamot Leaf Oil, \u2020Carrot Fruit Oil, Potassium Sorbate, |Benzyl Benzoate, |Benzyl Salicylate, |Farnesol, |Limonene, |Linalool', region='US'),
    'tbp-josh-rose-2': inci_composition('verified', 'jr-vital-balm',
        '*Aloe Vera Leaf Juice, *Mango Seed Butter, *Avocado Oil, *Jojoba Seed Oil, *Shea Butter, *Indian Senna Seed Extract (Botanical Hyaluronic Acid), *Vegetable Glycerin, *Gum Arabic, *Borage Seed Oil, *Evening Primrose Oil, *Honey, \u2020Broccoli Seed Oil, *Sea Buckthorn Oil, *Vitamin E, *Ashwagandha, *Turmeric, *Rose Hips, *Goji Berry, *Calendula, *Black Cohosh, *Elderberry, *Bladderwrack, *Marshmallow Root, *Ginger, *Fenugreek, *Chickweed, *Licorice, *Raspberry Leaf, *Dandelion, *Sage, *Eyebright, *Milk Thistle, *Rose Petal, *St. John\u2019s Wort, *Cat\u2019s Claw, *Cinnamon, *Lavender, *Ginkgo Biloba, *Rosemary, \u00a7Xanthan Gum, Potassium Sorbate, \u2020Blue Tansy Essential Oil, \u2020Ylang Ylang Essential Oil, \u2020Lavender Essential Oil, *Vanilla Extract, |Benzyl Benzoate, |Benzyl Salicylate, |Farnesol, |Limonene, |Linalool', region='US'),
    'tbp-josh-rose-3': inci_composition('verified', 'jr-collagen',
        '*Water (Aqua), *Glycerin, *Olea Europaea (Olive) Fruit Oil, Jojoba Esters, C12-16 Alcohols, Polyhydroxystearic Acid, Oryza Sativa (Rice) Seed Water, *Aloe Barbadensis (Aloe Vera) Leaf Juice, Chrondrus Crispus Extract, Sh-polypeptide-47 (Bioidentical Micro Collagen), Ectoin, Bambusa Arundinacea (Bamboo) Stem Extract, *Trametes Versicolor (Turkey Tail) Mushroom, *Inonotus Obliquus (Chaga Mushroom), Saccharomyces/Rice Ferment Filtrate, Pseudoalteromonas Ferment Extract, Chlorella Vulgaris Powder, Sodium Hyaluronate, Lactobacillus Ferment, Propanediol, Tocopherol (Vitamin E), *Citric Acid, Xanthan Gum, Leuconostoc/Radish Root Ferment Filtrate, Palmitic Acid, Sodium Anisate, Caprylyl/Capryl Glucoside, Caprylyl Glycol, Sodium Levulinate, Hydroxyacetophenone, Pentylene Glycol, 1,2-Hexanediol, Hydrogenated Lecithin, Phenethyl Alcohol, *Citrus Sinensis FCF (Orange) Peel Oil Expressed', region='US'),
    'tbp-josh-rose-4': inci_composition('verified', 'jr-toner',
        '*Aloe Vera Leaf Juice, *Glycerin, Water, Montmorillonite (Clay), Hibiscus Flower Acid, Sea Kelp Extract, Irish Moss Extract, Sodium Hyaluronate, Sodium PCA, Vitamin B5, L-Proline, Hydroxyproline, Galactoarabinan, *Green Tea Leaf, *Turmeric Root, *Calendula Flower, *Chamomile Flowers, *White Peony Tea, Glycolic Acid, *Echinacea, *Elderberry, Leuconostoc/Radish Root Ferment Filtrate, Phenethyl Alcohol, Ethylhexylglycerin', region='US'),
    'tbp-josh-rose-5': inci_composition('verified', 'jr-cleanse',
        '*Aloe Vera Gel, Saponified Coconut Oil, Water, *Honey, *Vegetable Glycerin, \u00a7Xanthan gum, \u2020Broccoli Oil, *Jojoba Oil, *Baobab Oil, *Hemp Seed Oil, *Borage Oil, *Argan Oil, *Sea Buckthorn Oil, *Avocado Oil, *Evening Primrose Oil, *Almond Oil, *Sunflower Oil, *Grape Seed Oil, *Sesame Oil, *Rose Petal, *Eyebright, *Turmeric, *Rosemary, *Sage, *Goji Berry, *Alfalfa, *Beetroot, *Dandelion, *Ashwagandha, *Marshmallow, *Raspberry Leaf, *Chickweed, *Calendula, *Elderberry, *Rose Hips, *Ginkgo, *Milk Thistle, *Black Cohosh, *Licorice, *Ginger, *Bladderwrack, *Fenugreek, *Hawthorn Berry, *Cats Claw, *Lavender Flowers, *St. Johns Wort, *Cinnamon, Potassium sorbate, *Vanilla extract, \u2020Rosemary Essential Oil, \u2020Ylang Ylang Essential Oil, \u2020Eucalyptus Essential Oil', region='US'),
    'tbp-josh-rose-6': inci_composition('verified', 'jr-c-complex',
        'Water, *Aloe Barbadensis (Aloe Vera) Leaf Juice, Glycerin, Chondrus Crispus (Irish Moss) Extract, 1,2-Hexanediol, Hydroxyacetophenone, Sodium Hyaluronate (Hyaluronic Acid), Tetrahexyldecyl Ascorbate (Vitamin C), *Helianthus Annuus (Sunflower) Seed Oil, Limnanthes Alba Seed Oil, 3-O-Ethyl-L-Ascorbic Acid (Vitamin C), *Calophyllum Inophyllum (Tamanu) Oil, Disteardimonium Hectorite, Polyglyceryl-2 Isostearate, Polyglyceryl-6 Polyricinoleate, Ferulic Acid, Olea Europaea (Olive) Fruit Oil, Caprylic/Capric Triglyceride, Azelaic Acid, Glycyrrhiza Glabra (Licorice) Root, Sodium Citrate, Rosa Canina (Rosehip) Seed Oil, Persea Gratissima (Avocado) Oil, Citric Acid Anhydrous, Tocopherol (Vitamin E), Polyglyceryl-10 Laurate, Xanthan Gum, Phenethyl Alcohol, Ethylhexylglycerin, Leuconostoc/Radish Root Ferment Filtrate, Citrus Sinensis (Orange) Oil', region='US'),
    'tbp-josh-rose-7': inci_composition('verified', 'jr-enzyme',
        '*Honey, *Vegetable Glycerin, *Avocado Oil, *Aloe Vera Leaf Juice, *Neem, *Echinacea, *Eyebright, *Fennel, *Yucca, *Sage, *Stevia, *Jojoba Oil, *Papaya Enzyme, Walnut shells, *Gum Arabic, *Guar Gum, *Sunflower Oil, *Evening Primrose Oil, *Turmeric, *Chamomile, *Calendula, *Elderberry, *Hawthorn Berry, *Alfalfa, *Ashwagandha, *Goji Berry, *Beetroot, *Bilberry, *Black Cohosh, *Rosemary, *Dandelion, *Foti Root, *Rose Hips, *Licorice, *Chickweed, *Horse Chestnut, *St. John\u2019s Wort, *Coriander, *Burdock, *Thyme, *Lavender, *Olive leaf, *Raspberry leaf, *Red Clover, \u00a7Xanthan Gum, Water, *Soy Lecithin, \u2020Lemon Essential Oil, \u2020Cypress Essential Oil, \u2020Fennel Essential Oil, \u2020Bergamot Essential Oil, \u2020Lime Essential Oil, Potassium Sorbate', region='US'),
    'tbp-josh-rose-8': inci_composition('verified', 'jr-hairspray',
        'Aqua, *Brown Rice Extract, *Yucca Starch, \u2020Orange Peel Oil Expressed, *Horsetail, *Lavender, *Peppermint, *Oregano, *Rosemary Leaf, *Sage, *Thyme, *Vegetable Glycerin, \u00a7Xanthan Gum, Potassium Sorbate, \u2020Rosemary Essential Oil, \u2020Ylang Ylang Essential Oil, \u2020Lavender Essential Oil', region='US'),
    'tbp-josh-rose-9': inci_composition('verified', 'jr-boost',
        'Aqua, *Glycerin, *Aloe Vera Juice, *Indian Senna Seed Extract (Botanical Hyaluronic Acid), *Horse Chestnut Extract, *White Peony Tea Leaf Extract, *Green Tea Leaf Extract, *Burdock Seed Extract, *Horsetail Extract, *Cacao Extract, *Chamomile Extract, *Calendula Extract, *Moringa Leaf Extract, *Neem Leaf Extract, *Arnica Extract, *Echinacea Extract, Hibiscus Flower Acid, Phenethyl Alcohol, Ethylhexylglycerin, Leuconostoc/Radish Root Ferment Filtrate, \u00a7Xanthan Gum', region='US'),
    # Ethique 洗发皂/护发皂组合：两份完整 INCI，按部位保留顺序
    'tbp-ethique-10': inci_composition('verified', 'et-shine',
        'Everyday Shine Shampoo Bar: Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Theobroma Cacao (Cocoa) Seed Butter, Aqua (Water), Decyl Glucoside, Glycerine, Brassica Alcohol, Coconut Acid, Cocos Nucifera (Coconut) Oil, Cocos Nucifera (Coconut) Fruit, Caprylic/Capric Triglyceride, Lactic Acid, Citrus Paradisi (Grapefruit) Peel Oil, Sodium Isethionate, Panthenol, Behentrimonium Methosulfate, Fragrance (Parfum), Mica, Ascorbic Acid, Limonene, Vanillin, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491). Everyday Shine Conditioner Bar: Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Glycerine, Cocos Nucifera (Coconut) Oil, Theobroma Cacao (Cocoa) Seed Butter, Stearic Acid, Caprylic/Capric Triglyceride, Panthenol, Citrus Paradisi (Grapefruit) Peel Oil, Fragrance (Parfum), Benzyl Alcohol, Mica, Dehydroacetic Acid, Aqua (Water), Ascorbic Acid, Limonene, Vanillin, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)',
        parts=[('Everyday Shine Shampoo Bar', 'Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Theobroma Cacao (Cocoa) Seed Butter, Aqua (Water), Decyl Glucoside, Glycerine, Brassica Alcohol, Coconut Acid, Cocos Nucifera (Coconut) Oil, Cocos Nucifera (Coconut) Fruit, Caprylic/Capric Triglyceride, Lactic Acid, Citrus Paradisi (Grapefruit) Peel Oil, Sodium Isethionate, Panthenol, Behentrimonium Methosulfate, Fragrance (Parfum), Mica, Ascorbic Acid, Limonene, Vanillin, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)'), ('Everyday Shine Conditioner Bar', 'Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Glycerine, Cocos Nucifera (Coconut) Oil, Theobroma Cacao (Cocoa) Seed Butter, Stearic Acid, Caprylic/Capric Triglyceride, Panthenol, Citrus Paradisi (Grapefruit) Peel Oil, Fragrance (Parfum), Benzyl Alcohol, Mica, Dehydroacetic Acid, Aqua (Water), Ascorbic Acid, Limonene, Vanillin, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)')]),
    'tbp-ethique-11': inci_composition('verified', 'et-volumising',
        'Volumising Shampoo Bar: Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Coconut Acid, Theobroma Cacao (Cocoa) Seed Butter, Brassica Alcohol, Citrus Aurantium Dulcis (Orange) Peel Oil, Caprylic/Capric Triglyceride, Lactic Acid, Glycerine, Magnesium Sulfate, Sodium Isethionate, Behentrimonium Methosulfate, Benzyl Alcohol, Caffeine, Mica, Biotin, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491). Volumising Conditioner Bar: Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Glycerine, Citrus Aurantium Dulcis (Orange) Peel Oil, Stearic Acid, Panthenol, Caprylic/Capric Triglyceride, Benzyl Alcohol, Mica, Biotin, Caffeine, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Aqua (Water), Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)',
        parts=[('Volumising Shampoo Bar', 'Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Coconut Acid, Theobroma Cacao (Cocoa) Seed Butter, Brassica Alcohol, Citrus Aurantium Dulcis (Orange) Peel Oil, Caprylic/Capric Triglyceride, Lactic Acid, Glycerine, Magnesium Sulfate, Sodium Isethionate, Behentrimonium Methosulfate, Benzyl Alcohol, Caffeine, Mica, Biotin, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)'), ('Volumising Conditioner Bar', 'Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Glycerine, Citrus Aurantium Dulcis (Orange) Peel Oil, Stearic Acid, Panthenol, Caprylic/Capric Triglyceride, Benzyl Alcohol, Mica, Biotin, Caffeine, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Aqua (Water), Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)')]),
    'tbp-ethique-12': inci_composition('verified', 'et-smoothing',
        'Smoothing Shampoo Bar: Sodium Cocoyl Isethionate, Sodium Coco-Sulfate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Brassica Alcohol, Caprylic/Capric Triglyceride, Cocos Nucifera (Coconut) Fruit, Coconut Acid, Lactic Acid, Sodium Isethionate, Behentrimonium Methosulfate, C13-16 Isoalkane, Fragrance (Parfum), Mica, Tin Oxide, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491). Smoothing Conditioner Bar: Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, C13-16 Isoalkane, Glycerine, Cocos Nucifera (Coconut) Oil, Panthenol, Fragrance (Parfum), Benzyl Alcohol, Mica, Dehydroacetic Acid, Aqua (Water), Tin Oxide, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)',
        parts=[('Smoothing Shampoo Bar', 'Sodium Cocoyl Isethionate, Sodium Coco-Sulfate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Brassica Alcohol, Caprylic/Capric Triglyceride, Cocos Nucifera (Coconut) Fruit, Coconut Acid, Lactic Acid, Sodium Isethionate, Behentrimonium Methosulfate, C13-16 Isoalkane, Fragrance (Parfum), Mica, Tin Oxide, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)'), ('Smoothing Conditioner Bar', 'Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, C13-16 Isoalkane, Glycerine, Cocos Nucifera (Coconut) Oil, Panthenol, Fragrance (Parfum), Benzyl Alcohol, Mica, Dehydroacetic Acid, Aqua (Water), Tin Oxide, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)')]),
    'tbp-ethique-4': inci_composition('verified', 'et-scalp',
        'Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Coconut Acid, Glycerine, Avena Sativa (Oat) Kernel Flour, Citrus Aurantifolia (Lime) Oil, Caprylic/Capric Triglyceride, Brassica Alcohol, Lactic Acid, Sodium Isethionate, Azadirachta Indica (Neem) Seed Oil, Pongamia Glabra (Karanja) Seed Oil, Behentrimonium Methosulfate, Limonene, Citrus Aurantium Peel Oil, Terpinolene, Terpineol, Pinene, Alpha-Terpinene'),
    'tbp-ethique-5': inci_composition('verified', 'et-clarifying',
        'Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Glycerine, Coconut Acid, Ricinus Communis (Castor) Seed Oil, Brassica Alcohol, Lactic Acid, Citrus Aurantium Dulcis (Orange) Peel Oil, Caprylic/Capric Triglyceride, Citrus Aurantifolia (Lime) Oil, Sodium Isethionate, Panax Ginseng Root Extract, Behentrimonium Methosulfate, Mica, Tin Oxide, Limonene, Citrus Aurantium Peel Oil, Terpinolene, Terpineol, Pinene, Alpha-Terpinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77492, CI 77491)'),
    'tbp-ethique-6': inci_composition('verified', 'et-scalp-shine',
        'Scalp Health Shampoo Bar: Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Coconut Acid, Glycerine, Avena Sativa (Oat) Kernel Flour, Citrus Aurantifolia (Lime) Oil, Caprylic/Capric Triglyceride, Brassica Alcohol, Lactic Acid, Sodium Isethionate, Azadirachta Indica (Neem) Seed Oil, Pongamia Glabra (Karanja) Seed Oil, Behentrimonium Methosulfate, Limonene, Citrus Aurantium Peel Oil, Terpinolene, Terpineol, Pinene, Alpha-Terpinene. Everyday Shine Conditioner Bar: Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Glycerine, Cocos Nucifera (Coconut) Oil, Theobroma Cacao (Cocoa) Seed Butter, Stearic Acid, Caprylic/Capric Triglyceride, Panthenol, Citrus Paradisi (Grapefruit) Peel Oil, Fragrance (Parfum), Benzyl Alcohol, Mica, Dehydroacetic Acid, Aqua (Water), Ascorbic Acid, Limonene, Vanillin, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)',
        parts=[('Scalp Health Shampoo Bar', 'Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Coconut Acid, Glycerine, Avena Sativa (Oat) Kernel Flour, Citrus Aurantifolia (Lime) Oil, Caprylic/Capric Triglyceride, Brassica Alcohol, Lactic Acid, Sodium Isethionate, Azadirachta Indica (Neem) Seed Oil, Pongamia Glabra (Karanja) Seed Oil, Behentrimonium Methosulfate, Limonene, Citrus Aurantium Peel Oil, Terpinolene, Terpineol, Pinene, Alpha-Terpinene'), ('Everyday Shine Conditioner Bar', 'Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Glycerine, Cocos Nucifera (Coconut) Oil, Theobroma Cacao (Cocoa) Seed Butter, Stearic Acid, Caprylic/Capric Triglyceride, Panthenol, Citrus Paradisi (Grapefruit) Peel Oil, Fragrance (Parfum), Benzyl Alcohol, Mica, Dehydroacetic Acid, Aqua (Water), Ascorbic Acid, Limonene, Vanillin, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)')]),
    'tbp-ethique-7': inci_composition('verified', 'et-clar-vol',
        'Clarifying Shampoo Bar: Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Glycerine, Coconut Acid, Ricinus Communis (Castor) Seed Oil, Brassica Alcohol, Lactic Acid, Citrus Aurantium Dulcis (Orange) Peel Oil, Caprylic/Capric Triglyceride, Citrus Aurantifolia (Lime) Oil, Sodium Isethionate, Panax Ginseng Root Extract, Behentrimonium Methosulfate, Mica, Tin Oxide, Limonene, Citrus Aurantium Peel Oil, Terpinolene, Terpineol, Pinene, Alpha-Terpinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77492, CI 77491). Volumising Conditioner Bar: Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Glycerine, Citrus Aurantium Dulcis (Orange) Peel Oil, Stearic Acid, Panthenol, Caprylic/Capric Triglyceride, Benzyl Alcohol, Mica, Biotin, Caffeine, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Aqua (Water), Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)',
        parts=[('Clarifying Shampoo Bar', 'Sodium Coco-Sulfate, Sodium Cocoyl Isethionate, Stearic Acid, Aqua (Water), Decyl Glucoside, Theobroma Cacao (Cocoa) Seed Butter, Glycerine, Coconut Acid, Ricinus Communis (Castor) Seed Oil, Brassica Alcohol, Lactic Acid, Citrus Aurantium Dulcis (Orange) Peel Oil, Caprylic/Capric Triglyceride, Citrus Aurantifolia (Lime) Oil, Sodium Isethionate, Panax Ginseng Root Extract, Behentrimonium Methosulfate, Mica, Tin Oxide, Limonene, Citrus Aurantium Peel Oil, Terpinolene, Terpineol, Pinene, Alpha-Terpinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77492, CI 77491)'), ('Volumising Conditioner Bar', 'Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Glycerine, Citrus Aurantium Dulcis (Orange) Peel Oil, Stearic Acid, Panthenol, Caprylic/Capric Triglyceride, Benzyl Alcohol, Mica, Biotin, Caffeine, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Aqua (Water), Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)')]),
    'tbp-ethique-8': inci_composition('verified', 'et-strength',
        'Strengthening Shampoo Bar: Sodium Cocoyl Isethionate, Stearic Acid, Sodium Cocoyl Glycinate, Coconut Acid, Glycerine, Betaine, Brassica Alcohol, Butyrospermum Parkii (Shea) Butter, Behentrimonium Methosulfate, Theobroma Cacao (Cocoa) Seed Butter, Sodium Isethionate, Aqua (Water), Guar Hydroxypropyltrimonium Chloride, Lactic Acid, Benzyl Alcohol, Sodium Chloride, Mentha Piperita (Peppermint) Oil, Helianthus Annuus (Sunflower) Seed Oil, Menthol, Biotin, Chenopodium Quinoa Seed Extract, Dehydroacetic Acid, Rosmarinus Officinalis (Rosemary) Leaf Extract, Citric Acid, Sodium Benzoate, Potassium Sorbate, Limonene, Mica, Titanium Dioxide (CI 77891), Chromium Oxide Greens (CI 77288). Volumising Conditioner Bar: Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Glycerine, Citrus Aurantium Dulcis (Orange) Peel Oil, Stearic Acid, Panthenol, Caprylic/Capric Triglyceride, Benzyl Alcohol, Mica, Biotin, Caffeine, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Aqua (Water), Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)',
        parts=[('Strengthening Shampoo Bar', 'Sodium Cocoyl Isethionate, Stearic Acid, Sodium Cocoyl Glycinate, Coconut Acid, Glycerine, Betaine, Brassica Alcohol, Butyrospermum Parkii (Shea) Butter, Behentrimonium Methosulfate, Theobroma Cacao (Cocoa) Seed Butter, Sodium Isethionate, Aqua (Water), Guar Hydroxypropyltrimonium Chloride, Lactic Acid, Benzyl Alcohol, Sodium Chloride, Mentha Piperita (Peppermint) Oil, Helianthus Annuus (Sunflower) Seed Oil, Menthol, Biotin, Chenopodium Quinoa Seed Extract, Dehydroacetic Acid, Rosmarinus Officinalis (Rosemary) Leaf Extract, Citric Acid, Sodium Benzoate, Potassium Sorbate, Limonene, Mica, Titanium Dioxide (CI 77891), Chromium Oxide Greens (CI 77288)'), ('Volumising Conditioner Bar', 'Brassica Alcohol, Behentrimonium Methosulfate, Hydrogenated Castor Oil, Theobroma Cacao (Cocoa) Seed Butter, Cocos Nucifera (Coconut) Oil, Glycerine, Citrus Aurantium Dulcis (Orange) Peel Oil, Stearic Acid, Panthenol, Caprylic/Capric Triglyceride, Benzyl Alcohol, Mica, Biotin, Caffeine, Fragrance (Parfum), Dehydroacetic Acid, Zingiber Officinale (Ginger) Root Oil, Aqua (Water), Citrus Aurantium Peel Oil, Limonene, Pinene, Linalool, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491)')]),
    'tbp-ethique-9': inci_composition('verified', 'et-curl',
        'Curl-Defining Shampoo: Sodium Cocoyl Isethionate, Stearic Acid, Sodium Cocoyl Glycinate, Glycerine, Coconut Acid, Theobroma Cacao (Cocoa) Seed Butter, Butyrospermum Parkii (Shea) Butter, Behentrimonium Methosulfate, Betaine, Brassica Alcohol, Sodium Isethionate, Aqua (Water), Fragrance (Parfum), Guar Hydroxypropyltrimonium Chloride, Lactic Acid, Benzyl Alcohol, Sodium Chloride, Cymbopogon Flexuosus (Lemongrass) Oil, Dehydroacetic Acid, Hydroxypropylgluconamide, Hydroxypropylammonium Gluconate, Tartaric Acid, Potassium Benzoate, Sodium Benzoate, Citral, Geraniol, Geranyl Acetate, Linalool, Mica, Titanium Dioxide (CI 77891), Ultramarines (CI 77007), Chromium Oxide Greens (CI 77288). Curl-Defining Conditioner: Behentrimonium Methosulfate, Brassica Alcohol, Theobroma Cacao (Cocoa) Seed Butter, Jojoba Esters, Butyrospermum Parkii (Shea) Butter, Glycerine, Caprylic/Capric Triglyceride, Stearic Acid, Ricinus Communis (Castor) Seed Oil, Guar Hydroxypropyltrimonium Chloride, Fragrance (Parfum), Sodium Methyl Cocoyl Taurate, Benzyl Alcohol, Cymbopogon Flexuosus (Lemongrass) Oil, Mica, Aqua (Water), Dehydroacetic Acid, Hydroxypropylgluconamide, Hydroxypropylammonium Gluconate, Tartaric Acid, Potassium Benzoate, Sodium Benzoate, Citral, Geraniol, Linalool, Geranyl Acetate, Titanium Dioxide (CI 77891), Chromium Oxide Greens (CI 77288)',
        parts=[('Curl-Defining Shampoo', 'Sodium Cocoyl Isethionate, Stearic Acid, Sodium Cocoyl Glycinate, Glycerine, Coconut Acid, Theobroma Cacao (Cocoa) Seed Butter, Butyrospermum Parkii (Shea) Butter, Behentrimonium Methosulfate, Betaine, Brassica Alcohol, Sodium Isethionate, Aqua (Water), Fragrance (Parfum), Guar Hydroxypropyltrimonium Chloride, Lactic Acid, Benzyl Alcohol, Sodium Chloride, Cymbopogon Flexuosus (Lemongrass) Oil, Dehydroacetic Acid, Hydroxypropylgluconamide, Hydroxypropylammonium Gluconate, Tartaric Acid, Potassium Benzoate, Sodium Benzoate, Citral, Geraniol, Geranyl Acetate, Linalool, Mica, Titanium Dioxide (CI 77891), Ultramarines (CI 77007), Chromium Oxide Greens (CI 77288)'), ('Curl-Defining Conditioner', 'Behentrimonium Methosulfate, Brassica Alcohol, Theobroma Cacao (Cocoa) Seed Butter, Jojoba Esters, Butyrospermum Parkii (Shea) Butter, Glycerine, Caprylic/Capric Triglyceride, Stearic Acid, Ricinus Communis (Castor) Seed Oil, Guar Hydroxypropyltrimonium Chloride, Fragrance (Parfum), Sodium Methyl Cocoyl Taurate, Benzyl Alcohol, Cymbopogon Flexuosus (Lemongrass) Oil, Mica, Aqua (Water), Dehydroacetic Acid, Hydroxypropylgluconamide, Hydroxypropylammonium Gluconate, Tartaric Acid, Potassium Benzoate, Sodium Benzoate, Citral, Geraniol, Linalool, Geranyl Acetate, Titanium Dioxide (CI 77891), Chromium Oxide Greens (CI 77288)')]),
    # Paula's Choice：官网 All Ingredients 完整表
    'tbp-paulas-choice-2': inci_composition('verified', 'pc-moisturizer',
        'Aqua/Water/Eau, Dimethicone, Squalane, Glycerin, Pyrus Malus (Apple) Fruit Extract, Pentylene Glycol, 1, 2-Hexanediol, Ammonium Acryloyldimethyltaurate/VP Copolymer, Butylene Glycol, Hydroxyacetophenone, Sodium Acrylates Copolymer, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Gigartina Stellata Extract, Acetyl sh-Hexapeptide-5 Amide Acetate, Tridecapeptide-1, Oligopeptide-1, Sodium Phytate, Propanediol, Lecithin, Hydroxypropyltrimonium Hyaluronate, Cyanocobalamin, Phenoxyethanol', region='US'),
    'tbp-paulas-choice-3': inci_composition('verified', 'pc-cellular',
        'Aqua/Water/Eau, Propanediol, Glycerin, Triheptanoin, Methyl Gluceth-20, Simmondsia Chinensis (Jojoba) Seed Oil, Tridecyl Trimellitate, Maltodextrin, 1, 2-Hexanediol, Dimethicone, Taurine, Bacillus Ferment, Ganoderma Lucidum (Mushroom) Stem Extract, Helianthus Annuus (Sunflower) Sprout Extract, Goji Fruit Extract, Acetyl Tetrapeptide-2, Isomalt, Coco-Caprylate/Caprate, Hydroxyacetophenone, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, C9-12 Alkane, Dilinoleic Acid/Butanediol Copolymer, Glyceryl Behenate, Polyglyceryl-6 Octastearate, Sodium Phytate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Potassium Chloride, Acacia Senegal Gum, Xanthan Gum, Polysorbate 60, Sorbitan Isostearate, Synthetic Fluorphlogopite, Caprylyl Glycol, Citric Acid, Castor Oil/IPDI Copolymer, Lecithin, Cyanocobalamin, Tin Oxide, Iron Oxides, Titanium Dioxide', region='US'),
    'tbp-paulas-choice-5': inci_composition('verified', 'pc-cleanser',
        'Salicylic Acid, Water, Sodium Lauroyl Sarcosinate, Acrylates/Steareth-20 Methacrylate Copolymer, Glycerin, PEG-200 Hydrogenated Glyceryl Palmate, Sodium Laureth Sulfate, Arginine, Butylene Glycol, PEG-7 Glyceryl Cocoate, Panthenol, Disodium EDTA, Citric Acid, PEG-60 Hydrogenated Castor Oil, Sodium Citrate, Phenoxyethanol, Caprylyl Glycol, Chlorphenesin', region='US'),
    'tbp-paulas-choice-6': inci_composition('verified', 'pc-retinol',
        'Water, Dimethicone, Glycerin, Butylene Glycol, Isononyl Isononanoate, Castor Isostearate Succinate, Glyceryl Stearate, C12-15 Alkyl Benzoate, Dimethicone Crosspolymer, PEG-33, Polysorbate 20, Behenyl Alcohol, PEG-100 Stearate, Pentaerythrityl Tetraisostearate, Polymethylsilsesquioxane, Tetrahexyldecyl Ascorbate, Retinol, Ceramide NG, Palmitoyl Tetrapeptide-7, Palmitoyl Hexapeptide-12, Sodium Hyaluronate, Dipotassium Glycyrrhizate, Glycyrrhiza Glabra (Licorice) Root Extract, Avena Sativa (Oat) Kernel Extract, Arctium Lappa, Salix Alba Extract, Glycine Soja Sterols, Lecithin, Allantoin, Tocopheryl Acetate, Hydrolyzed Soy Protein, Sorbitan Laurate, Acetyl Dipeptide-1 Cetyl Ester, Disodium EDTA, Hydroxyethylcellulose, Palmitoyl Tripeptide-1, Sodium Hydroxide, Tribehenin, Caprylyl Glycol, Ethylhexylglycerin, Pentylene Glycol, PEG-75 Shea Butter Glycerides, PPG-12/SMDI Copolymer, PEG-10 Phytosterol, PEG-8 Dimethicone, PEG-14, Magnesium Aluminum Silicate, Arachidyl Glucoside, Arachidyl Alcohol, Sclerotium Gum, Carbomer, Phenoxyethanol, Benzoic Acid', region='US'),
    'tbp-paulas-choice-7': inci_composition('verified', 'pc-gloss',
        'Hydrogenated Polyisobutene, Polybutene, Diisostearyl Malate, Bis-Diglyceryl Polyacyladipate-2, Glyceryl Behenate, Synthetic Beeswax, Caprylic/Capric Triglyceride, Butyrospermum Parkii Butter, Cetearyl Ethylhexanoate, Ethylhexyl Palmitate, Ricinus Communis (Castor) Seed Oil, Dimethyl Isosorbide, Palmitoyl Tripeptide-1, Palmitoyl Tripeptide-38, Tridecapeptide-1, Sesamum Indicum (Sesame) Seed Extract, Portulaca Pilosa Extract, Pentylene Glycol, Prunus Domestica Seed Oil, Aqua/Water/Eau, Sodium Hyaluronate, Tribehenin, Sorbitan Isostearate, Hydrogenated Castor Oil, Lactic Acid, Tocopherol, Sucrose Cocoate, Vanillin, Red 7 Lake, Iron Oxides, Titanium Dioxide', region='US'),
    'tbp-paulas-choice-9': inci_composition('verified', 'pc-eye',
        'Water, Dimethicone, Pentylene Glycol, Silica, Squalane, Undecane, Glycerin, Pyrus Malus (Apple) Fruit Extract, Tridecane, 1, 2-Hexanediol, Ammonium Acryloyldimethyltaurate/VP Copolymer, Cetyl Alcohol, Polyglyceryl-10 Laurate, Polyglyceryl-4 Caprate, Hydroxyacetophenone, Propanediol, Tridecapeptide-1, Palmitoyl Tetrapeptide-7, Acetyl Hexapeptide-8, Arginine/Lysine Polypeptide, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Sodium Phytate, Sorbitan Oleate, Diosmine, Coleus Forskohlii Root Extract, Caprylyl Glycol, Xanthan Gum, Glyceryl Caprylate, Pseudoalteromonas Ferment Extract, Tocopherol', region='US'),
}


def env():
    values = {}
    for line in ENV.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"')
    return values


def request(url, config, body=None, method='GET', extra=None):
    headers = {'apikey': config['KEY'], 'Authorization': 'Bearer ' + config['KEY']}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if extra:
        headers.update(extra)
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    command = ['curl', '-sS', '--max-time', '40', '--retry', '3', '--retry-all-errors',
               '--retry-delay', '1', '-X', method]
    for key, value in headers.items():
        command += ['-H', key + ': ' + value]
    if body is not None:
        command += ['--data-binary', '@-']
    command.append(url)
    result = subprocess.run(command, input=data, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', 'ignore')[:500])
    return 200, json.loads(result.stdout.decode('utf-8') or '[]')


def main():
    apply = '--apply' in sys.argv
    config = env()
    config['KEY'] = config['SUPABASE_SERVICE_ROLE_KEY']
    base = config['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1/consumer_catalog_products'
    report = []
    for product_id, value in PAYLOADS.items():
        _, rows = request(base + '?select=id,product&id=eq.' + product_id, config)
        if len(rows) != 1:
            report.append({'id': product_id, 'result': 'SKIP', 'reason': 'ROW_NOT_UNIQUE'})
            continue
        product = rows[0]['product']
        current = product.get('composition') or {}
        if current.get('status') == 'verified':
            report.append({'id': product_id, 'result': 'SKIP', 'reason': 'ALREADY_VERIFIED'})
            continue
        if current.get('status') not in ('not_provided',):
            report.append({'id': product_id, 'result': 'SKIP', 'reason': 'UNEXPECTED_STATUS_' + str(current.get('status'))})
            continue
        if canonical(product.get('sourceUrl') or '') != canonical(value['sourceUrl']):
            report.append({'id': product_id, 'result': 'SKIP', 'reason': 'SOURCE_URL_MISMATCH'})
            continue
        updated = dict(product)
        updated['composition'] = value
        if apply:
            request(base + '?id=eq.' + product_id, config, {'product': updated}, method='PATCH')
        report.append({'id': product_id, 'result': 'WRITTEN' if apply else 'DRY_RUN',
                       'oldStatus': current.get('status'), 'newStatus': value['status'],
                       'itemCount': len(value['items']), 'sourceUrl': value['sourceUrl'],
                       'verifiedAt': value.get('verifiedAt')})
    out = ROOT / 'deliverables' / 'composition-backfill-2026-11-26.json'
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print('report:', out)


# One-off repair: 5 wash-care rows written with the pre-fix splitter that broke
# INCI locants ("1,2-Hexanediol" -> ["1", "2-Hexanediol"]). Only rewrites items
# when the already-verified rawText/source match exactly, so no data is invented.
LOCANT_REPAIR_IDS = [
    'tbp-josh-rose-3', 'tbp-josh-rose-6',
    'tbp-paulas-choice-2', 'tbp-paulas-choice-3', 'tbp-paulas-choice-9',
]


def repair_locant():
    apply = '--apply' in sys.argv
    config = env()
    config['KEY'] = config['SUPABASE_SERVICE_ROLE_KEY']
    base = config['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1/consumer_catalog_products'
    report = []
    for product_id in LOCANT_REPAIR_IDS:
        expected = PAYLOADS[product_id]
        _, rows = request(base + '?select=id,product&id=eq.' + product_id, config)
        if len(rows) != 1:
            report.append({'id': product_id, 'result': 'SKIP', 'reason': 'ROW_NOT_UNIQUE'})
            continue
        product = rows[0]['product']
        current = product.get('composition') or {}
        guards = {
            'status': current.get('status') == 'verified',
            'rawText': current.get('rawText') == expected['rawText'],
            'sourceUrl': canonical(current.get('sourceUrl') or '') == canonical(expected['sourceUrl']),
        }
        if not all(guards.values()):
            report.append({'id': product_id, 'result': 'SKIP', 'reason': 'GUARD_FAIL', 'guards': guards})
            continue
        old_names = [x['name'] for x in current['items']]
        new_names = [x['name'] for x in expected['items']]
        if old_names == new_names:
            report.append({'id': product_id, 'result': 'NOOP', 'reason': 'ALREADY_CORRECT'})
            continue
        updated = dict(product)
        updated['composition'] = {**current, 'items': expected['items']}
        if apply:
            request(base + '?id=eq.' + product_id, config, {'product': updated}, method='PATCH')
        report.append({'id': product_id, 'result': 'REPAIRED' if apply else 'DRY_RUN',
                       'oldCount': len(old_names), 'newCount': len(new_names),
                       'oldLocant': [n for n in old_names if n in ('1', '2-Hexanediol')],
                       'newLocant': [n for n in new_names if 'Hexanediol' in n]})
    out = ROOT / 'deliverables' / 'composition-locant-repair-2026-11-26.json'
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print('report:', out)


if __name__ == '__main__':
    if '--repair-locant' in sys.argv:
        repair_locant()
    else:
        main()
