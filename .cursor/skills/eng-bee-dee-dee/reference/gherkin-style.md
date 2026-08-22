# Gherkin style (BeeDeeDee lint)

Rules mirror BeeDeeDee’s `lintFeatures` behaviour. Author so these stay clean.

## Severity guide

| Rule | Severity | Meaning |
|------|----------|---------|
| `missing-scenario-name` | error | Scenario has no name |
| `empty-scenario` | error | Scenario has no steps |
| `duplicate-scenario-name` | warning | Same name twice in one feature (normalized) |
| `inconsistent-step-keyword` | warning | Opens with And/But/`*` |
| `too-many-steps` | warning | More than **10** steps |
| `missing-feature-description` | info | No description under `Feature:` |
| `untagged-feature` | info | Feature has no tags |
| `step-without-given` | info | No Given in the scenario |

Errors block CI-style `behavior lint` failure modes; warnings/info should still be fixed when authoring.

## Hard requirements

1. Every scenario has a non-empty name.
2. Every scenario has at least one step.
3. Do not start a scenario with `And`, `But`, or `*`.
4. Prefer ≤10 steps; split if longer.
5. Prefer a `Given` that states starting context.
6. Give the Feature a short description line.
7. Tag the Feature (area and/or risk) so tests and filters can attach.
8. No duplicate scenario names inside one feature (ignore case/spacing).

## Style

- Business-readable steps; no CSS/XPath/role chains as the step text.
- One behaviour per scenario.
- Shared setup → `Background:`.
- Policy clusters → `Rule:` with nested scenarios.
- Parameterised examples → `Scenario Outline` + `Examples`.
- Tags on the Feature by default; scenario tags when they differ (`@wip`, `@draft`).

## Canonical shape

See [../examples/login.feature](../examples/login.feature):

```gherkin
@auth @smoke
Feature: Login
  Members sign in with an email address and password to reach their dashboard.

  Background:
    Given the application is available

  Scenario: Successful login
    Given a registered member
    When they submit valid credentials
    Then they reach their dashboard
    And their name appears in the header

  Rule: Sessions expire after inactivity

    Scenario: Session times out
      Given a member who signed in an hour ago
      When they request a protected page
      Then they are returned to the sign-in page
```

## Ids (informational)

BeeDeeDee builds URL-safe ids with `.` separators from feature/scenario slugs. Stable **scenario names** keep ids stable across updates — do not rename casually.
