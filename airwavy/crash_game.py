import pyautogui
import time
"""
time.sleep(2)
print(pyautogui.position())
"""
time.sleep(2)
bal = 200000000000000000000000000000000000000
while True:
    pyautogui.click(600, 800)
    pyautogui.typewrite("/gamble")
    time.sleep(.1)
    pyautogui.press("enter")
    time.sleep(.05)
    pyautogui.press("enter")
    time.sleep(2.5)
    pyautogui.click(378, 708)
    time.sleep(.1)
    pyautogui.click(416, 655)
    time.sleep(3)
    pyautogui.click(375, 689)
    time.sleep(3)
    pyautogui.typewrite(f"{bal:.0f}")
    pyautogui.press("enter")
    print("\n"*50)
    print("I LOVE GAMBLING")
    print(f"{bal:.0f}")
    bal *= 1.035
    time.sleep(.1)
    pyautogui.press("enter")
    time.sleep(3)
    pyautogui.click(375, 689)
    time.sleep(1)
