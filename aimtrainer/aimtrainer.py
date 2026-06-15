import pyautogui
import time

time.sleep(2)
pyautogui.click(600, 800)

40, 210 - 920, 700
for a in range(30):
    time.sleep(0.1)
    for i in range((920-40)/10):
        for j in range((700-210)/10):
            pyautogui.click(20+i*10, 210+j*10)