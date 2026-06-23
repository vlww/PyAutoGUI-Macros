import pyautogui
import time

time.sleep(2)

for i in range(1000):
    if (i<10):
        pyautogui.write("00")
        pyautogui.write(str(i))
    elif (i<100):
        pyautogui.write("0")
        pyautogui.write(str(i))
    else:
        pyautogui.write(str(i))
    pyautogui.press('backspace', 3)