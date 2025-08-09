These are the key user roles for the application are:
1. Member
2. Canvasser
3. Organizer
4. Administrator

All users of the system must have a login. The only thing that is publicly accessible is a landing page which includes some basic info about the project and a login form.
The roles are ordered by increasing access. Each role has all the accesses of the roles with lower number than it, plus additional ones for its role. 
This means all users minimally have the Member role.

# Member
Members can view summary pages with information such as:
1. A summary view of progress on how many people have voted
2. Other summary level information as defined later. 

Members do not, by default, have the right to view any details about homeowners or other members. 

# Canvasser
A Canvassers is a Member who will be going door-to-door to talk to potential voters to encourage them to vote. 
Canvassers will be assigned homes to canvass by an Organizer. These assignments can change from time to time. 

Canvassers can see certain information all homes, specifically:
* Address of the home
* Names of homeowners at that address
* Whether the system has a recorded vote for each homeowner at each assigned address
* A list of previous `Interaction Records` for that address (i.e., notes from Canvassers who have previously canvassed that address)

Canvasser can see the list of specific houses assigned to them to canvas. 

A Canvasser can:
* Create a new `Interaction Record` for any member homes regardless of whether he is assigned to canvas it or not. 

Then can also see the list of homes they have previously canvased along with the total count of homes canvased and total votes received by those homes.   

# Organizer
An Organizer has the same access as a Canvasser and Member. 
An Organizer can do the following:
* assign and re-assign homes to Canvassers
* assign homes to multiple Canvassers
* Promote a Member to a Canvasser
* Demote a Canvasser to Member

An Organizer can view the following:
* all data about homeowners
* canvass assignments (current and past) 
* report related to which canvassers have completed which assignments

# Administrator
An Administrator has the rights of all other roles plus more. 
An Administrator can do the following:
* Establish a login for a user to become a Member
* Promote any Member to any other role
* Demote the role of any user
* Deactivate the login for any user
* can update any data in the database
