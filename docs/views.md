This document describes system views and operations.

# Externally-Accessible Pages

These pages can be reached by anyone on the internet and without login.

Notes about passwords:

* All passwords should be strong, including at least 12 characters with a mix of upper and lower case letters, at least
  one number and at least 1 special character.
* Forms to create or reset passwords should enforce this requirement.

## External Landing Page

* It will display the `logo.png`
* It will contain some basic text about the project.
* It will contain a login form. When the user successfully logs in, he is navigated to the `Internal Landing Page`.
* it will contain a link to the `Sign-up for Login Page` and invite users without a login to click that link to
  register.
* It will contain a link for "Forgot My Password"

When `Forgot My Password Link` is clicked:

* The page checks that an email is input into the login form for the username. If not, it shows an error indicating that
  the user must enter it.
* The page then displays that an email will be sent to the user if he is a registered user
* The system checks whether that user is a registered `Memeber` in the system.
    * If the user is a `Member`, then a 1-time `Reset Password Link` to the `Reset Password Page` is sent to the user's
      email. This link will expire in 60 minutes.
    * If the user has submitted a registration but has not yet been accepted, then an email is sent to the user
      indicating that his registration is pending and will be able to log in when it is accepted.
    * If the user's registration has been rejected, no email is sent and the system does nothing.

## Reset Password Page

This page is intended to be access with a 1-time URL parameter generated when the user clicks the
`Forgot My Password Link` in an email.

The system checks if the 1-time link is valid, including that it has not expired (it expires after 60 minutes) and has
not been used before.
If the link is expired, this fact is displayed to the user and a link to the `External Landing Page` is given.
If the 1-time value is invalid, an error message is given to that effect.

If the 1-time link is valid, the system then marks it as used and no longer valid in the DB.
The user is shown a form to enter a new password and save it.
After saving a new password, the user is redirected automatically to the `External Landing Page` login form.

## Sign-up for Login Page

* This will contain text indicating that the user will need to be verified as a SWHOA member before the login is
  granted.
* It will have a registration form with fields:
    * Email (which will be used as the login name)
    * Password
    * First Name
    * Last Name
    * Street Address
    * Mobile phone number
      There will be no fields for city, state, and zip as these will be assumed to be Broadlands, VA, 20148
      respectively.

Upon submission:

* The submission will be recorded in the database along with the submission date and time.
* A confirmation email will be sent to the user with a unique 1-time link to the `Email Verification Page`
* An email notification will be sent to all Administrator users with a link to the `Enroll Member Page`

## Email Verification Page

This page is intended to be access with a 1-time URL parameter generated when the user submits the form on the
`Sign-up for Login Page`, and gets the link in an email. Upon clicking the link, it will navigate this to this page,
where it will check the 1-time value against the registration in the DB. If it is good, then the user's login is
activated, and he is given a `Member` role. A successful registration message is shown and the login form is displayed.
The user can then log in after which he is navigated to the `Internal Landing Page`.

If the 1-time value is invalid, an error message is given and the user is displayed a link to the
`Sign-up for Login Page`.

If the 1-time value was previously processed, a message to that effect is shown, and the user is shown the login form
the same as if the registration was successful the first time.

# Login-Required Pages

All the following pages require a user to be logged in to access them. Each will have its own URL that can be
bookmarked.
If the user is not logged in, or login has expired when they try to navigate to this page, the user will be required to
log in. On successful login, the user will be automatically navigated to the URL they were trying to navigate to.

Logins should expire after 7 days of inactivity.

## Enroll Member Page

This page can only be accessed by users with `Administrator` role.

This page shows a list of users who have filled out the form on the `Sign-up for Login Page` but have not yet
been accepted. It shows a table of all the open submissions, showing columns for all fields and the submission date and
time.
The table should be sortable by any column ascending or descending by clicking on the column header which sort by that
column.
Clicking multiple times on the same column header toggle between ascending and descending sort.

Each row of the table includes a button to accept or reject the submission.
If Accept is clicked, an email is sent to the email of the user registering telling them that they have been accepted
and includes a link to the `Internal Landing Page`, inviting them to log in.

## All Internal Pages

All internal pages will include the following:

* It will include a header with navigation links to all internal pages that can be accessed given the user's role.
* A `Logout Link` will also be on the header navigation.

Upon clicking the `Logout Link`, the user is logged out and redirected automatically to the `External Landing Page`

## Internal Landing Page

At the top of the page, it will show:

* It will display a voting progress bar showing the % of votes recorded
* It will display a second progress bar showing the progress of "yes" votes progressing toward 80% of votes.
* It will display the % "yes" votes and % "no" votes thus far, and the ration of yes:no votes.

### Inbox Section

This section shows an inbox of activities for the logged-in user, including:

#### For those with `Canvasser` role:

Canvassing assignments:

* This will show the number of houses outstanding to canvas. Houses are outstanding if the user (or any other user) has
  not entered
  an `Interaction Record` for that address with a date after the assignment date.
* It gives a link to the `Canvassing Page`
* It gives a link to the `Record Absentee Owner Interaction Page`

#### For those with `Administrator` role:

* Registrations to approve or deny

### Actions Section

For those with `Organizer` role a link to the `Organize Canvassing Page`

### Administrative Actions Section

For those with `Administrator` role:

* Change a user's role (change the role of any user in the system, except he cannot take away Administrator from
  himself)
* Invalidate login of any user in the system except himself

## User Profile Page

Accessible for Roles: `Member` (i.e., all roles)

This page shows:

* The user's Role
* All the information given in the Registration form.

This page allows the user to change:

* Mobile phone number
* Password

## Reports Page

The `Reports Page` can be seen by users with `Organizer` and `Administrator` roles.

This page contains the following links that, when clicked, open a report view.
Canvassing Report
Canvasser reports
Interaction reports
View absentee owners info / report

# Canvassing Page

This page can be accessed by users with `Canvasser` role.

The page will display a Google map that calls-out homes that are currently assigned for that user to canvas.
The page has a toggle button to "Show All" or "Show Mine." "Show Mine" is the default view.
When "Show All" is togged on, then all of the homes that do not have a vote recorded and are not owned
by Absentee Owners are called-out.

This page is intended to be viewed on the user's phone and is expected to see the user's current location.
The page view centers on the user's location by default but zooms out to show callouts.

The user can zoom and scroll the map at will.

The user can click on a call-out on a home, then a `Record Canvas Interaction View` appears.
The user can submit this form or simply dismiss.
The general idea, is that the person can walk around the neighborhood following what is on the
Google Map, then enter a record when stopped at a house.

The Google Map should show the person's current location and update as the person moves.

# Record Canvas Interaction View

This view can be accessed by users with `Canvasser` role via the `Canvassing Page`.

This view is a form that can be submitted or dismissed. It is intended to be used on a mobile phone.

Given that the user has clicked on a home in the `Canvassing Page` to open this form, the page already knows the
property address. The form then gives fields:

* A checkbox list of owners for that property and "Other." Zero, one or many boxes can be checked.
    * The view indicates if the owner has voted already
* An interaction type checkox including options: (zero or more may be selected)
    * Spoke to homeowner(s)
    * Spoke to other occupant
    * Left a flyer
* An optional "Notes" text field

When submitted, the form captures this information in an `Interaction Record`, which including the above field, the
property street address, the date and time of submission, and the
latitude and longitude of the device submitting if that is accessible.

After successful submission, the property is no longer assigned to the user to canvas, and the callout on the
Google Map should disappear.

Also on this page is a link to the `Canvassing History Page`. The link includes the URL parameter to make
the page show just information related to this property. This link will open in a new brower tab
so that the user still has the current tab open.

### Canvassing History Page

This page is accessible by users with `Canvasser` role.

This page allows the user to see a chronological list of `Interaction Records.`
A URL parameter can be passed to this page indicating the property of interest, then only
`Interaction Records` associated with that property are displayed.

### Record Absentee Owner Interaction Page

This page is accessible by users with `Canvasser` role.

The user can see a list of `Absentee Owners`, i.e., those who do not live at their home address.
This can be inferred by noting that the billing address for the homeowner is different
from the property address.

The user can select any `Absentee Owner` then fill out a form:
How the owner was contacted such as email, phone, text, and/or mail.
The user can put in notes about the interaction.
This will be saved in the DB. It is considered a kind of `Interaction Record`

### Record Votes Page

This page is only accessible to users with `Administrator` role.

The users can look up any homeowner or property and record that fact that the homeowner has voted.
He can optionally recorder if the homeowner voted "yes" or "no."

On this page, the user can upload a CSV file to input votes in bulk.

### Organize Canvassing Page

This page is accessible to users with `Organizer` role.
This page allows the user to create and manage Canvassing Assignments.

#### Make Canvassing Assignments

This section gives a drop-down list of users with `Canvasser` role (or higher).
It has a table of all of the properties that:

* Have owners who have not voted
* Do not have absentee owners

It includes columns for:

* Street address
* Homeowner name
* Whether there is a current canvassing assignment for the address
* Names of homeowners who have not voted
* Notes - includes a link - when clicked opens a new browser tab to the Canvassing History Page for that address

Each column (except the Notes column) has a text field where the user can type in text. The table will automatically
filter rows showing only those rows where some of the text matches what is typed it. The filter is case-insensitive.

The table should also include a column with a checkbox in each row to select it. It should also have a checkbox
at the box to select all displayed rows. The selection should be remembered even when rows that were selected
are not being shown because they are not filtered out.

There should be a button to "Assign Canvasing." This assigns all 
