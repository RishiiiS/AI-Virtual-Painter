def award_guesser(player):
    player.score += 10

def award_drawer(drawer, correct_count, used_gesture):
    drawer.score += 10 * correct_count
    if used_gesture:
        drawer.score += 50
