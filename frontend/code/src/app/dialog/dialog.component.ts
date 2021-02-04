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
          title: "Let's prepare for your eco journey",
          body: [
            "Open the Sidebar and insert the coordinates of departure and destination.",
            "In addition you can also specify the maximum autonomy of your vehicle, how much autonomy you have at the moment and the departure time. This will help us provide you the best solution for your journey",
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
          title: "Second tut",
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