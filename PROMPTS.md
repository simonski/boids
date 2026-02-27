# PROMPTS

32 of them as-is, unvarnished.

```bash

1. 
Create fullscreen Boids sandbox

Create an HTML application using THREE JS to perform a BOIDS simulation.
Include a slider to vary the nmber of birds in the boids simulation.
Make it a fullscreen 3d sandbox 1 KM square and do not allow the birds to exceed the bounding box.

2. 
make the birds flap their winngs - they should be a handful of triangles only each.

3.
how shoudl this be serving? I dont want to load it asa file.  What is a lightweight way to serve this over http? also the slider does not update the bird count.  I see no birds.

4.
add another slider to vary the sandbox size from 1km square down to 100m squared.

5. 
add another slider to vary the bird size; use perlin noise to establish the initial bird sizes across all birds where they vary to 10%

6. 
extract the javascript from the index,html into an app.js

7. 
introduce a hawk bird (via. gui toggle) which "scares" nearby birds and chases them

8. 
update README to explain how to run this as a webserver with a simple command

9. 
make the hawk red.  all birds should be wireframes

10. 
persist the settings in localStorage for next load

11. 
make the settings window half the width

12. 
add WSAD and freelook for the camera so the user can move the camera around.  SHIFT moves double-speed.

13. 
javascript error devtools: Uncaught TypeError: Failed to resolve module specifier "three". Relative references must start with either "/", "./", or "../".

14. 
if the user stops moving around or changing the camera, revert to a slowly moving camera that is orbiting looking into the sandbox to get an overall view of the boids algo running

15. 
the sandbox size does nto seem to vary; that is, it seems to zoom the camera but not change the size of hte world.   The birds are all flying very fast also.  Perhaps once theworld size is 1km squared it will improve.

16. 
I think the birds are too large; make them appropriate sizes according to teh world size; change the to be beads instead of wireframes, the bird colour should vary intensity of the similar colour, teh hawk shoudl be a solid bead of red

17. 
increase the sandbox max size to 10km squared

18. 
reduce the settings dialg width by 50%

19. 
update the bird velocity so that it is reaslistic against actual bird flight.  What is a beach dwelling flocking bird?

> "A good beach-dwelling flocking bird is the sanderling (also dunlin and many shorebirds).
> These speed values are tuned to feel closer to small shorebird flock flight rather than > stylized arcade movement."

20. 
double click the "boids simulation" to minimise/grow the settings dialog

21. 
increase the max birds to 5000

22. 
when I get to higher numbers it slows down.  What can be optimised?

23. 
go for it, optimise it al

24. 
mnouse over the "boids simulation" shoudl animate grow the settings dialog, while the mouse is "over" this dialog it shoudl stay active - mouse away from it and it should wait then animate back to the smaller state.

25. 
Added animated expand/collapse CSS with #ui.expanded and #uiContent transitions in index.html.
Wrapped controls in #uiContent to animate content visibility.
Added hover-delay + pin logic in app.js (mouseenter, mouseleave, dblclick).

auto orbit shoudl not change the current "zoom" the user has set.

26. 
Whatever “zoom” the user currently has when auto-orbit kicks in is maintained.

chagne the hawk toggle to a hawk count where it goes from 0 to 100

27. 
Set hawks from 0 to 100 live.
0 means no hawks.
Count persists on reload.

slow the settings animation down by 200%, make it ease in.  Also, the initial state should be a single row "boids simulation", not multirow

28. 
make a favicon of a little boid

29. 
createa makefile wiht make, make run, make deploy which 1. shows usage, 2. runs a python3 on 8000, 3. scps to boids.exe.dev all the files

30. 
the bird boids are blackl make them blue or near-white; vary their colour across the birds with perlin noise when creating them

31. 
the birds are quite "Straight line" flyers - can you upat ethem to be more along arcs?

32. 
make the birds much brighter - I canot see them unless I zom right in

```

-----

```bash
33.
As the user modifies settings, navigates/zooms in/out and rotates, encode the settings (birds, size, position) to a hex value which is rendered in a "share" link bottom-right.  This link should be unique - which is the hex value is the configuration setting of all the values the user can change.  It shoudl be shareable as the full URL which then "sets" all the settings to this situatio - menaing a user can create a cool position or scenario and then share it.

34.
SPACE should toggle the rotating camera on/off

35. 
The share link should just be "share" - dont show the hex value.  

36.
The share link should just be a single link: "share" - dont show the hex value and dont show two words - just the link itself.

37.
The title and URL in the website keep chanigng to reflect the share ID. I don't want to "see" the share ID changing; hide it so that the share link is valid, but onceit is clicked on it does NOT change in the URL or search bar.

38.
Clicking on the share link
    - should show a popup "share link copied to clipboard"
    - shoudl copy the link tothe clipboard so the user can paste to a friend or themselves


39.
Create a new branch, 2d 0 introuce a V keystroke to switch betwen 2d and 3d.   Ease in and animate between 2d and 3d views.   The 2d should zoom out show the entre x/y to the window size, going back to 3d should revert to teh original 3d view.