@auth
Feature: Password reset
  Members who cannot sign in can request a reset link by email.

  Scenario: Reset link requested
    Given a registered member
    When they request a password reset
    Then they receive a reset email

  Scenario: Reset link expires
    Given a reset link issued two days ago
    When the member opens the link
    Then they see an expired link message

  Scenario Outline: Rejected passwords
    Given a member following a valid reset link
    When they submit the password "<password>"
    Then they see the message "<message>"

    Examples:
      | password | message                          |
      | short    | Password is too short            |
      | password | Password is too easily guessed   |
