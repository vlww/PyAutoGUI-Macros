import pyautogui
import time
import random

# edge on 959
refresh_interval = 600 #10min
start_time = time.time()

time.sleep(2)



# NOT DONE YET:::

positions = [
    [280, 455], [280, 455], [530, 455],
    [405, 455], [405, 600],
    [280, 600], [530, 600],
    [655, 455], [655, 600]
]

pyautogui.click(793,229)
time.sleep(0.1)

while True:
    if time.time() - start_time >= refresh_interval:
        pyautogui.click(270,100)
        pyautogui.write("https://www.chess.com/game/live/171222556760?username=rookdowntoelectricavenue&move=0")
        pyautogui.press('enter')
        time.sleep(3) 
        start_time = time.time()
        pyautogui.click(793,229)
        time.sleep(0.1)

    pyautogui.click(720, 529) 
    time.sleep(0.5)
    num = random.randint(0, 8) #extra for weighting
    pyautogui.click(positions[num][0],positions[num][1])
    if (num<=3):
        pyautogui.click(460, 495) #small
    else:
        pyautogui.click(460, 515) #big
    time.sleep(1.5)
    pyautogui.click(485,275)
    time.sleep(0.1)