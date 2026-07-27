def is_iban_valid(value: str) -> bool:
    """
    ISO 7064 MOD 97-10 checksum, the standard IBAN validation algorithm:
    move the first 4 characters to the end, convert letters to numbers
    (A=10, B=11, ... Z=35), and the resulting number must be == 1 mod 97.

    This is the IBAN equivalent of Luhn for credit cards - a shape match
    alone (2 letters + 2 digits + up to 30 more) lets through a lot of
    text that merely looks IBAN-shaped, and a failed checksum is a very
    reliable sign it isn't a real IBAN.
    """
    iban = value.replace(" ", "").replace("-", "").upper()

    if not (15 <= len(iban) <= 34):
        return False
    if not iban[:2].isalpha() or not iban[2:4].isdigit():
        return False

    rearranged = iban[4:] + iban[:4]
    if not rearranged.isalnum():
        return False

    numeric = "".join(str(int(ch, 36)) for ch in rearranged)
    return int(numeric) % 97 == 1
