@billing @finance
Feature: Refunds
  Support staff can refund an invoice within thirty days.

  Scenario: Full refund inside the window
    Given an invoice paid last week
    When support issues a full refund
    Then the subscriber is credited the full amount

  Scenario: Refund refused outside the window
    Given an invoice paid two months ago
    When support attempts a refund
    Then they see a message that the window has closed
