---
type: spec
id: event-medics
title: Event medics
status: draft
updated: 2026-08-24
summary: Volunteers produce cover hours and often leave financially stressed.
jurisdiction: NZ
tags:
  - health
  - volunteer
  - pathway
---

# Demo Gurki system

> Illustrative numbers for BeeDeeDee's Gurki vertical slice. Named after the
> Wellington Free Ambulance event-medic shape on gurki.nz.

System: Event medics

Scenario: A young volunteer is accepted onto the event team
Given an ambulance service covering community events
And a 19-year-old aiming at paramedicine
When they are accepted as an event-medic volunteer
Then they are on the event roster
Output 1 volunteer on the event team
Outcome they have a supervised pre-hospital pathway
Activates The volunteer completes event-medic training

Scenario: The volunteer completes event-medic training
Given an accepted event-team volunteer
And a first-aid certificate that the volunteer must fund
When they complete training
Then they can be deployed to events
Output $245 in course costs paid by the volunteer
And 1 event-medic sign-off
Outcome they are deployable for event cover
Activates An event medic covers a stadium fixture

Scenario: An event medic covers a stadium fixture
Given a signed-off volunteer on the roster
And a stadium fixture that needs on-site first response
When the event runs
Then patients are assessed in the first-aid room
Output 14 hours of event cover
And 9 patients assessed
Outcome the event can run with on-site first response
And the volunteer holds logged clinical hours toward a health career
But they missed a paid weekend shift
Activates The volunteer sits a paramedicine application

Scenario: The volunteer sits a paramedicine application
Given logged event-medic hours and a first-aid sign-off
When they apply for a paramedicine programme
Then the application includes supervised event hours
Output 1 application with event-medic hours attached
Outcome they are a stronger applicant for health study
But they remain financially stressed from unpaid events and training costs
Activates A young volunteer is accepted onto the event team
