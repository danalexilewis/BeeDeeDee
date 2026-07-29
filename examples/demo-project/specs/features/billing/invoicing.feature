@billing
Feature: Invoicing
  Subscribers are invoiced on the anniversary of their signup.

  Scenario: Monthly invoice generated
    Given an active monthly subscription
    When the billing date arrives
    Then an invoice is generated
    And the subscriber receives it by email

  Scenario: Failed payment retried
    Given a subscription whose card was declined
    When the retry window opens
    Then the payment is attempted again

  Scenario: Cancelled subscription is not invoiced
    Given a cancelled subscription
    When the billing date arrives
    Then no invoice is generated
