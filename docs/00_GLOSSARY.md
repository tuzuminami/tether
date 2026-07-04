# 00. 用語・境界定義

    ## プロダクト境界
    `TETHER` は **Relationship State Engine** を提供する。
    会話UI、アカウント管理、課金、本人確認、汎用モデレーションUIは外部システムの責務とする。

    ## 主要エンティティ
    - `Relationship`: Relationshipに関する不変IDを持つドメイン要素。
- `RelationshipModel`: RelationshipModelに関する不変IDを持つドメイン要素。
- `StateVector`: StateVectorに関する不変IDを持つドメイン要素。
- `Event`: Eventに関する不変IDを持つドメイン要素。
- `TransitionRule`: TransitionRuleに関する不変IDを持つドメイン要素。
- `Snapshot`: Snapshotに関する不変IDを持つドメイン要素。
- `Explanation`: Explanationに関する不変IDを持つドメイン要素。
- `Boundary`: Boundaryに関する不変IDを持つドメイン要素。

    ## 共通用語
    - **Tenant**: データ分離の最小単位。組織・アプリ・環境を表す。
    - **Subject**: Tenant内の対象者または対象エージェント。個人識別子をそのまま保存しない。
    - **Actor**: APIまたは管理操作を行う主体。人間、サービス、ジョブを含む。
    - **Correlation ID**: 1つの要求から派生するログ、監査、外部呼出しを結ぶID。
    - **Policy reference**: 外部または内蔵の規則セットを識別する参照。未解決時に安全解除はしない。
    - **Plugin**: 安定SPIを介して接続する拡張部品。コアの永続化モデルを直接操作してはならない。
    - **fail-closed**: 判定不能・認証不能・設定破損時に、実行を停止または明示的に保留する振る舞い。

    ## データ分類
    | 区分 | 例 | 既定取扱い |
    |---|---|---|
    | Public | 公開可能な設定名 | ログ可 |
    | Internal | ルート設定、内部ID | 最小限ログ |
    | Sensitive | 会話由来の属性、連絡先、認可情報 | 保存・表示・exportを最小化 |
    | Secret | APIキー、署名鍵、認証トークン | 値の永続・ログ出力を禁止 |
