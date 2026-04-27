# GrailChaser — Component Naming Convention

Use these names **verbatim** in both Figma and React so design and code map 1:1.

## Core rules

- **PascalCase** for components: `ShowModeResult`
- One component per file
- Use suffixes only when helpful:
  - `Screen` for ambiguous full screens (`LoginScreen`)
  - `Modal` / `Sheet` / `Drawer` for overlays
- Prefer composition over config:
  - `ShowModeResult`, not `ResultScreen mode="show"`

## Directory structure

```txt
src/components/
  auth/
  onboarding/
  home/
  scan/
  show/
  card/
  collection/
  box/
  grading/
  selling/
  search/
  portfolio/
  profile/
  settings/
  shell/
  atoms/
```

## Figma page/frame naming

- `Auth — LoginScreen`
- `Home — HomeScreen`
- `Show — ShowModeHomeIdle`
- `Show — ShowModeHomeActive`
- `Show — ShowModeResult`
- `Card — CardDetail`
- `Collection — MyCardsList`
- `Collection — MyCardsGrid`
- `Box — BoxDetail`
- `Modal — MoveCardModal`
- `Sheet — BulkActionSheet`

## Locked screen components

### Auth / onboarding
- `LoginScreen`
- `SignUpScreen`
- `EmailVerifyScreen`
- `ForgotPasswordScreen`
- `OnboardingWelcome`

### Home / hub
- `HomeScreen`
- `GameTabs`
- `QuickActionsRow`
- `CollectionSummaryCard`
- `InsightsRow`
- `RecentActivityFeed`

### Scan
- `QuickCheckCamera`
- `AddCardCamera`
- `RecognitionResult`
- `PickVersionModal`
- `CardCaptureGuide`
- `GlareWarningToast`

### Show Mode
- `ShowModeHomeIdle`
- `ShowModeHomeActive`
- `ShowModeResult`
- `StartShowModal`
- `EndShowModal`
- `NegotiateModal`
- `VerdictStrip`
- `DecisionMathPanel`

### Card detail
- `CardDetail`
- `CardHero`
- `CardIdentity`
- `PricePanel`
- `PriceHistoryChart`
- `OwnershipPanel`
- `OwnedCopiesDrawer`
- `OwnedCopyRow`
- `GradeCheckSection`
- `SellOptimizerPanel`
- `CardNotes`
- `CardActionsMenu`
- `ReplaceScanModal`
- `EditCardDetailsModal`
- `ConfirmDeleteCardModal`

### Collection / storage
- `MyCardsList`
- `MyCardsGrid`
- `CardListRow`
- `CardGridTile`
- `BulkSelectMode`
- `BulkActionSheet`
- `TierBreakdownView`
- `WatchlistScreen`
- `PickListScreen`
- `BoxesList`
- `BoxCard`
- `BoxDetail`
- `NewBoxModal`
- `EditBoxModal`
- `MoveCardModal`
- `StorageMap`

### Grading / selling
- `GradeCheckFlow`
- `ConditionSlider`
- `GradeProbabilityResult`
- `GradingQueueScreen`
- `SubmissionTierPicker`
- `EnterGradeScreen`
- `ListingBuilder`
- `PlatformPicker`
- `ListingPhotosUploader`
- `MarkSoldScreen`
- `SellOptimizerDetail`

### Search / portfolio / profile
- `SearchScreen`
- `SetBrowser`
- `SetDetail`
- `PortfolioDashboard`
- `PerformanceOverTime`
- `InsightsFeed`
- `SalesHistory`
- `ProfileScreen`
- `PastShowsList`
- `ShowDetail`
- `SettingsHome`
- `AccountSettings`
- `AppPreferences`
- `NotificationsSettings`
- `DataPrivacySettings`

## System components

- `AppShell`
- `BottomNav`
- `BottomNavTab`
- `TopBar`
- `ModalTopBar`
- `EmptyState`
- `LoadingSkeleton`
- `ErrorBanner`
- `OfflineBanner`
- `Toast`
- `BottomSheet`

## Action Engine atom

Use a single component:

```tsx
<ActionButton variant="buy" />
<ActionButton variant="walk" />
<ActionButton variant="negotiate" />
<ActionButton variant="grade" />
<ActionButton variant="move" />
<ActionButton variant="sell" />
<ActionButton variant="watch" />
<ActionButton variant="pull" />
<ActionButton variant="list" />
```

## Other reusable atoms

- `TierBadge`
- `TrendIndicator`
- `PricePill`
- `GameBadge`
- `RarityBadge`
- `StatusPill`
- `ConfidenceBandBadge`
- `DecisionBadge`
- `CaptureButton`
- `CardImage`
- `Sparkline`
- `TextInput`
- `MoneyInput`
- `Select`
- `Toggle`
- `Chip`
- `Card`
- `SectionHeader`
- `StatCard`

## Naming traps to avoid

- Do not use generic names like `Modal`, `Page`, or `Container`
- Do not use `Card` for everything
- Do not use plurals unless it is truly a list (`BoxesList`, `PastShowsList`)
- Do not use `MoreMenu` — it was removed from the final nav
- Do not use alternate Show Mode labels; keep:
  - `Market Value`
  - `Dealer Ask`
  - `Max Buy`
  - `Verdict`
