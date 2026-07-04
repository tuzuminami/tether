# 08. トレーサビリティ

    ## 1. 要求→設計→テスト
    | Mission | Stakeholder | System requirement | Architecture / Design | Test |
    |---|---|---|---|---|
    | BMA-001 | STR-TETHER-001 | FR-TET-001 | AD-001 / DD-001 | AT-TETHER-001 |
| BMA-002 | STR-TETHER-002 | FR-TET-003 | AD-004 / DD-003 | TEST-AUDIT-001 |
| BMA-003 | STR-TETHER-003 | FR-TET-004 | AD-005 / DD-004 | TEST-FAILCLOSED-001 |
| BMA-004 | STR-TETHER-004 | NFR-001 / NFR-002 / NFR-008 | AD-003 / DD-002 | TEST-SEC-001 |
| BMA-005 | STR-TETHER-005 | FR-TET-005 | AD-005 / API-SPI-001 | TEST-PLUGIN-001 |
| BMA-006 | STR-TETHER-006 | NFR-007 | AD-002 / ADR-001 | TEST-PORT-001 |

    ## 2. 変更管理ルール
    - 要求変更は`CHANGE-<id>`としてIssue化し、影響するSyRS、AD、DD、API、テストIDを更新する。
    - 互換性に影響する変更はADRを追加する。
    - Version公開後の仕様は履歴を残し、静的URLまたはtagで追跡可能にする。
    - リリースノートには、機能、破壊的変更、migration、known limitationを記載する。
