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

  Scenario: Wrong password
    Given a registered member
    When they submit an incorrect password
    Then they see an invalid credentials message
    And they remain on the sign-in page

  Scenario: Locked account
    Given a member whose account is locked
    When they submit valid credentials
    Then they see a lockout message

  Rule: Sessions expire after inactivity

    Scenario: Session times out
      Given a member who signed in an hour ago
      When they request a protected page
      Then they are returned to the sign-in page
