def is_luhn_valid(value: str) -> bool:
    digits = [int(d) for d in value if d.isdigit()]
    if not digits:
        return False

    total = 0
    reverse_digits = digits[::-1]

    for i, digit in enumerate(reverse_digits):
        if i % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit

    return total % 10 == 0