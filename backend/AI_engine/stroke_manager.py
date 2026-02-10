class StrokeManager():
    def __init__(self):
        self.Xprev = 0
        self.yprev = 0
    def getStroke(self,x,y,color,thickness):
        if self.Xprev == 0 and self.yprev == 0:
            self.Xprev,self.yprev = x,y
            return None
        stroke = {
            "x1":self.Xprev,  #star drawing from x1,y1 to x2,y2
            "y1":self.yprev,
            "x2":x,
            "y2":y,
            "color":color,
            "thickness":thickness
        }

        self.Xprev, self.yprev = x, y
        return stroke