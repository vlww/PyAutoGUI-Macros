import time
import pyautogui
import random

time.sleep(2)

a=1
while True:
    pyautogui.press("tab", 3)
    pyautogui.press("enter")
    pyautogui.press("down",a)
    a+=1
    if a>51:
        a=1
    pyautogui.press("enter")
    time.sleep(1)
    pyautogui.press("tab")
    # 20 or 28
    if a==20:
        if (int(random.random()*2)+1) == 1:
            pyautogui.press("down",1)
        else:
            pyautogui.press("down",6)
    elif a==28:
        pyautogui.press("down",int(random.random()*3)+2)
    else:
        pyautogui.press("down",5)
        time.sleep(.3)
    pyautogui.press("tab",2)
    pyautogui.press("down",4)
    pyautogui.press("tab")
    pyautogui.press("down",2)
    pyautogui.press("tab",2)
    pyautogui.press("enter")
    time.sleep(1)
    pyautogui.hotkey("command", "r", interval=0.25)
    time.sleep(2)
