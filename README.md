# TETHER

    > 関係性を説明可能な状態遷移として管理するイベント駆動エンジン

    ## 概要
    信頼、親しさ、協働度、境界などの関係性を、イベント・明示的な遷移ルール・減衰則で扱う汎用状態エンジン。

    ## このパッケージの位置付け
    本ZIPは、`tether` を単独OSSリポジトリとして着手するための**要求定義・設計・検証・実装バックログ**一式です。
    商用利用・セルフホスト・クラウド提供を阻害しないことを前提に、ライセンスはApache-2.0を採用します。

    ## 想定利用者
    AIコンパニオン、ゲームNPC、教育支援、顧客接点、コミュニティ運営のプロダクトチーム。

    ## 解決する範囲
    - `Relationship State Engine`
    - マルチテナント、監査、Plugin拡張、外部LLM／ローカルLLMとの疎結合を前提にする
    - AI恋愛・コンパニオン用途に限らず、ゲーム、教育、顧客接点、業務AIへ転用可能とする

    ## 非対象
    - 人間の感情や恋愛感情を真実として推定しない。
- 利用者を依存させる最適化を提供しない。
- 心理診断や治療判断を行わない。

    ## ドキュメント索引
    | ファイル | 内容 |
    |---|---|
    | `AGENTS.md` | 実装担当AI・人間開発者向けの不変ルール |
    | `docs/00_GLOSSARY.md` | 用語・境界定義 |
    | `docs/01_BMA.md` | 事業・ミッション分析（15288） |
    | `docs/02_StRS.md` | ステークホルダー要求（29148） |
    | `docs/03_SyRS.md` | システム要求（29148 / 25010） |
    | `docs/04_AD.md` | アーキテクチャ記述（42010） |
    | `docs/05_DD.md` | 設計記述（12207） |
    | `docs/06_API_CONTRACT.md` | HTTP API・イベント・Plugin契約 |
    | `docs/07_VV_PLAN.md` | 検証・妥当性確認計画 |
    | `docs/08_TRACEABILITY.md` | 要求→設計→テストのトレース |
    | `docs/09_MVP_BACKLOG.md` | GitHub Issue化可能なMVPバックログ |
    | `docs/10_RELEASE_CRITERIA.md` | v0.1.0公開判定基準 |

    ## 推奨初期技術基盤
    - TypeScript（strict） / Node.js LTS / pnpm
    - Fastify または同等の高速HTTPフレームワーク
    - PostgreSQL（`tether`の主要状態を永続化）
    - OpenAPI 3.1、JSON Schema、Docker Compose
    - Vitest、Testcontainers、ESLint、Prettier、GitHub Actions
    - 監査・運用メトリクスはOpenTelemetry互換のtrace IDを前提とする

    ## 初期リポジトリ構造
    ```text
    tether/
    ├── apps/api/             # HTTP API
    ├── packages/core/        # ドメイン・ユースケース
    ├── packages/contracts/   # JSON Schema / OpenAPI / DTO
    ├── packages/plugins/     # Plugin SPIと標準実装
    ├── packages/sdk-ts/      # TypeScript SDK
    ├── tests/                # unit / integration / contract / e2e
    ├── docs/                 # 本パッケージのドキュメント
    ├── AGENTS.md
    └── docker-compose.yml
    ```

    ## リリース名
    - Repository: `tether`
    - Display name: `TETHER`
    - 初期目標: `v0.1.0`（MVP、API互換性は試験段階）
