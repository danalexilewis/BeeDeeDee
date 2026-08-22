Feature: Exports
  Administrators export activity data for their own reporting.

  Scenario: CSV export of monthly activity
    Given an administrator viewing last month
    When they export the activity as CSV
    Then the file contains one row per member

  Scenario: Export of an empty period
    Given an administrator viewing a period with no activity
    When they export the activity as CSV
    Then the file contains only a header row
