import pyautogui
import time
import random

# edge on 730
refresh_interval = 600 #10min
start_time = time.time()

time.sleep(2)

positions = [
    [185, 450], [185, 610],
    [415, 450], [300, 610],
    [300, 450], [415, 610],
    [530, 450], [530, 610]
]

#positions = [
#    [225, 470], [225, 625],
#    [440, 470], [335, 625],
#    [335, 470], [440, 625],
#    [550, 470], [550, 625]
#]


c = 0
while c<2273:
    if time.time() - start_time >= refresh_interval:
        pyautogui.click(270,100)
        pyautogui.write("https://www.chess.com/member/bye")
        pyautogui.press('enter')
        time.sleep(3) 
        start_time = time.time()

    pyautogui.click(430, 335) #720,220
    time.sleep(0.1)
    pyautogui.click(300, 485) #600,365
    time.sleep(0.3)
    num = random.randint(0, 7)
    pyautogui.click(positions[num][0],positions[num][1])
    if (num<=3):
        pyautogui.click(365, 515) #400,520
    else:
        pyautogui.click(365, 495) #400,500
    time.sleep(1.5)
    pyautogui.click(410,280)
    time.sleep(0.1)
    c+=1