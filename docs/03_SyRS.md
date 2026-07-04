# 03. SyRS — システム要求仕様
    **参照:** ISO/IEC/IEEE 29148、品質特性はISO/IEC 25010を参照。

    ## 1. 機能要求
    | ID | 要求 | 受入条件 |
|---|---|---|
| FR-TET-001 | RelationshipModelで状態軸、値域、イベント、遷移規則、減衰規則を宣言できる。 | 値域外・未定義イベントの投入は422で拒否する。 |
| FR-TET-002 | 入力Eventから状態遷移を原子的に計算しSnapshotを保存できる。 | 同一idempotency keyの再送は状態を二重更新しない。 |
| FR-TET-003 | 各状態変化について適用規則・前後値・根拠Eventを説明として返せる。 | Explanation APIが規則IDと計算経路を返す。 |
| FR-TET-004 | Boundary違反イベントは状態加点ではなく、警告または外部Policy参照へ遷移させる。 | 設定されたBoundaryに反する加点規則はModel検証時に拒否する。 |
| FR-TET-005 | 時間経過による減衰を再現可能なジョブとして実行できる。 | 同一基準時刻での再計算結果が一致する。 |
| FR-TET-006 | Model VersionとRelationship Snapshotの互換性を管理できる。 | 旧ModelでのSnapshotは移行完了前に新規計算へ使用しない。 |

    ## 2. 非機能要求
    | ID | 要求 | 受入条件 |
|---|---|---|
| NFR-001 | Tenant分離 | 全読取・更新・削除クエリにtenant_idが必須。越境試験は403または404。 |
| NFR-002 | 認証・認可 | 全変更APIでactorとscopeを検証。匿名変更を許可しない。 |
| NFR-003 | 可用性と縮退 | 外部依存のtimeoutは設定可能。安全上重要な依存失敗ではfail-closed。 |
| NFR-004 | 観測性 | 全HTTP要求・外部呼出し・状態遷移にcorrelation IDを付与。 |
| NFR-005 | 性能 | 標準的な同期APIは依存成功時p95 300ms以下を目標。重い処理は非同期ジョブ化。 |
| NFR-006 | 保守性 | domain / adapter / transportを分離し、依存方向をlintまたはarchitecture testで検証。 |
| NFR-007 | 移植性 | LinuxコンテナとPostgreSQLで稼働。クラウド固有SDKをcoreへ導入しない。 |
| NFR-008 | データ保護 | Secretをログ・例外・fixtureに出力しない。Sensitiveデータの保持期間を設定可能にする。 |

    ## 3. データ完全性要求
    - すべての変更可能リソースは`id`、`tenantId`、`createdAt`、`createdBy`、`version`を持つ。
    - 追記専用の監査イベントは物理更新を禁止し、訂正は後続イベントで表現する。
    - 楽観ロックまたはVersion条件を使い、lost updateを防止する。
    - request id / idempotency keyを受け付ける変更APIは、再送による副作用の重複を防止する。

    ## 4. セキュリティ要求
    - 認可前にデータ存在を詳細に漏らさない。
    - 監査ログは本文よりもID、ハッシュ、理由コードを優先する。
    - SecretはSecretReferenceで参照し、APIのGET／export対象から除外する。
    - 開発用seedデータは実在の個人情報を含めない。

    ## 5. 互換性要求
    - RESTは`/v1`で開始する。
    - 破壊的変更は新API versionまたは明示されたdeprecation期間を設ける。
    - Plugin SPIはcore APIと別のSemVer範囲で管理し、互換性テストを公開する。
