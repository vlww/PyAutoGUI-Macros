import pyautogui
import time
import random

# edge on 732

time.sleep(2)
positions = [
    [225, 470], [225, 625],
    [440, 470], [335, 625],
    [335, 470], [440, 625],
    [550, 470], [550, 625]
]


while True:
    pyautogui.click(720,220)
    time.sleep(0.1)
    pyautogui.click(600,365)
    time.sleep(0.5)
    num = random.randint(0, 7)
    pyautogui.click(positions[num][0],positions[num][1])
    if (num<=3):
        pyautogui.click(400,520)
    else:
        pyautogui.click(400,500)
    time.sleep(0.1)
    pyautogui.click(410,280)
    time.sleep(0.1)



# 225 470
# 335
# 440
# 550

#.    625


#400 520
#400 500
#400 520
#400 500
#400 520
#400 520
#400 500
#400 500