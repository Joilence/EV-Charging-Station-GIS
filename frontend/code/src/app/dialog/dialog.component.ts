import { Component, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss']
})
export class DialogComponent implements OnInit {
  content = {}

  constructor(public dialog: MatDialog) {}
  

  ngOnInit(): void {
  }

  //old
  openDialog() {
    console.log(this.content)
    const dialogRef = this.dialog.open(DialogComponent);
    dialogRef.componentInstance.content = {
      title: "Welcome to JED!",
      body: ["Are you ready to travel with us through Germany with your Electric Vehicle?",
      "If it is your first time here, follow this tutorial.",
      "Happy Routing!"
    ],
      button: "Start Tutorial",
      index: 0
    }

    dialogRef.afterClosed().subscribe(result => {
      console.log(`Dialog result: ${result}`);
    });
  }

  startTutorial(index: number){
    const dialogRef = this.dialog.open(DialogComponent);
    switch (index){

      case 1:
        dialogRef.componentInstance.content = {
          title: "Let's prepare for your electric journey",
          body: [
            "Open the Sidebar and insert the coordinates of departure and destination.",
            "Tell us more: how much power do you already have? When does the journey start?",
            "This will help us provide you the best solution for your journey.",
            "Tip: Select \"Include Featured Restaurant\" if you wish to find a special place to stop during your trip!"
          ],
          img: "assets/sidebar.png",
          button1: "Prev",
          button2: "Next",
          index: index,
        }
        break;
      case 2:
        dialogRef.componentInstance.content = {
          title: "Time for a charge?",
          body: [
            "Here is the fastest route for your destination.",
            "Where do you want to stop for a charge?",
            "You can select any point on the map to see the available charging stations in that area.",
            "Tip: In the highlighted orange route your battery is very low. Make sure to charge it before it's too late!",
            "Tip tip: Zeit ist Geld. Hover on the clocks along the route to see the estimated time."
          ],
          img: "assets/start.png",
          button1: "Prev",
          button2: "Next",
          index: index
        }
        break;
        case 3:
          dialogRef.componentInstance.content = {
            title: "Choice overload: solved. ",
            body: [
              "You want to stop around Stuttgard but..where exactly?",
              "There are more than 12K stations in out database, and in many areas this can be overwhelming. Colors will help you through the choice.",
              "A green icon means lot of attractivity: start selecting one of them and click \"Show Restaurants\"."
            ],
            img: "assets/isochrone.png",
            button1: "Prev",
            button2: "Next",
            index: index
          }
          break;
          case 4:
            dialogRef.componentInstance.content = {
              title: "Feel hungry yet?",
              body: [
                "Charging an EV can require time. Why don't use it for a lunch break?",
                "Here you have all the restaurants, pubs, bars and cafe at a walking distance from the selected station. Hover on the icons to have more information and start thinking about what to order...",
                "Tip: The yellow icons are Featured Restaurants, recommended by the Michelin Guide. A good choice if you are looking for a luxury break.",
                "Tip Tip: Don't drink and drive! The map also shows Biergartens, but only for the passengers..."
              ],
              img: "assets/restaurants.png",
              button1: "Prev",
              button2: "Next",
              index: index
            } 
            break;
          case 5:
            dialogRef.componentInstance.content = {
              title: "Time to go!",
              body: [
                "Click outside of the circle to go back to the stations and keep exploring the area.",
                "Once you have made your choice, click Select station: the route will be updated with the deroute to the selected station. ",
                "Repeat the station selection until all the route becomes green.",
                "Tip: When selecting a station, indicate whether you want to stop for a full or a fast charge (80%). This will help us update the travel time and show when the next charge stop is needed."
              ],
              img: "assets/arrival.png",
              button1: "Prev",
              button3: "Finish",
              index: index
            } 
            break;
          case 6:
            dialogRef.componentInstance.content = {
              title: "End of tutorial",
              body: [
                
              ],
              button1: "Prev",
              button2: "Next",
              index: index
            } 
            break;
          case 3:
            dialogRef.componentInstance.content = {
              title: "Tut",
              body: [
    
              ],
              button1: "Prev",
              button2: "Next",
              index: index
            } 
            break;
      default:
        dialogRef.componentInstance.content = {
          title: "Welcome to JED!",
          body: ["Are you ready to travel with us through Germany with your Electric Vehicle?",
          "If it is your first time here, follow this tutorial.",
          "Happy Routing!"
        ],
          button2: "Start Tutorial",
          index: 0
        }
      }

    dialogRef.afterClosed().subscribe(result => {
      console.log(`Dialog result: ${result}`);
    });
  }
}

@Component({
  selector: 'app-dialog-example',
  templateUrl: './dialog.component-example.html',
})
export class DialogComponentExampleDialog {}


@Component({
  selector: 'app-tutorial1',
  templateUrl: './tutorial/tutorial1.html',
})
export class Tutorial1 {
  constructor(public dialog: MatDialog) { }
}