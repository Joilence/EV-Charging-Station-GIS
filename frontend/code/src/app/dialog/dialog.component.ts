import { Component, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss']
})
export class DialogComponent implements OnInit {
  // content = {
  //   title: "Title",
  //   index: 0 
  // };

  content = {}

  constructor(public dialog: MatDialog) { 
  }
  

  ngOnInit(): void {
  }

  openDialog() {
    // const dialogRef = this.dialog.open(DialogComponentExampleDialog);

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
      case 0:
        dialogRef.componentInstance.content = {
          title: "First tut",
          button: "Next",
          index: 1
        }
        break;
      case 1:
        dialogRef.componentInstance.content = {
          title: "Second tut",
          button: "Next",
          index: 2
        }
        break;
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