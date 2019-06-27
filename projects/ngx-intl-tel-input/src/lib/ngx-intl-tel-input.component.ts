import { Component, OnInit, forwardRef, Input, ViewChild, ElementRef, Renderer2, SimpleChanges, OnChanges } from '@angular/core';
import { ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import { CountryCode } from './data/country-code';
import { phoneNumberValidator } from './ngx-intl-tel-input.validator';
import { Country } from './model/country.model';
import * as lpn from 'google-libphonenumber';

@Component({
	selector: 'ngx-intl-tel-input',
	templateUrl: './ngx-intl-tel-input.component.html',
	styleUrls: ['./ngx-intl-tel-input.component.css'],
	providers: [
		CountryCode,
		{
			provide: NG_VALUE_ACCESSOR,
			// tslint:disable-next-line:no-forward-ref
			useExisting: forwardRef(() => NgxIntlTelInputComponent),
			multi: true
		},
		{
			provide: NG_VALIDATORS,
			useValue: phoneNumberValidator,
			multi: true,
		}
	]
})
export class NgxIntlTelInputComponent implements OnInit, OnChanges {

	@Input() value = '';
	@Input() preferredCountries: Array<string> = [];
	@Input() enablePlaceholder = true;
	@Input() cssClass = 'form-control';
	@Input() onlyCountries: Array<string> = [];
	@Input() enableAutoCountrySelect = false;
	@Input() searchCountryFlag = false;
	@Input() searchCountryField = []; // dialCode, iso2, name, all
	@Input() maxLength = ''; // dialCode, iso2, name, all
	@Input() tooltipField = ''; // iso2, name
	@Input() selectFirstCountry = true;
	@Input() selectedCountryISO = '';
	@Input() phoneValidation: any = true;
	selectedCountry: Country = {
		areaCodes: undefined,
		dialCode: '',
		flagClass: '',
		iso2: '',
		name: '',
		placeHolder: '',
		priority: 0
	};

	phoneNumber = '';
	allCountries: Array<Country> = [];
	preferredCountriesInDropDown: Array<Country> = [];
	phoneUtil = lpn.PhoneNumberUtil.getInstance();
	disabled = false;
	errors: Array<any> = ['Phone number is required.'];
	countrySearchText = '';

	@ViewChild('countryList') countryList: ElementRef;

	onTouched = () => { };
	propagateChange = (_: any) => { };

	constructor(
		private countryCodeData: CountryCode,
		private render: Renderer2,
		private elementRef: ElementRef
	) { }

	ngOnInit() {

		this.fetchCountryData();
		if (this.preferredCountries.length) {
			this.getPreferredCountries();
		}
		if (this.onlyCountries.length) {
			this.allCountries = this.allCountries.filter(c => this.onlyCountries.includes(c.iso2));
		}
		if (this.selectFirstCountry) {
			if (this.preferredCountriesInDropDown.length) {
				this.selectedCountry = this.preferredCountriesInDropDown[0];
			} else {
				this.selectedCountry = this.allCountries[0];
			}
		}
		this.getSelectedCountry();
	}

	ngOnChanges(changes: SimpleChanges) {
		if (this.allCountries && changes['selectedCountryISO'] && changes['selectedCountryISO'].currentValue !== changes['selectedCountryISO'].previousValue) {
			this.getSelectedCountry();
		}
		if (changes.preferredCountries) {
			this.getPreferredCountries();
		}
	}

	getPreferredCountries() {
		if (this.preferredCountries.length) {
			this.preferredCountriesInDropDown = [];
			this.preferredCountries.forEach(iso2 => {
				const preferredCountry = this.allCountries.filter((c) => {
					return c.iso2 === iso2;
				});

				this.preferredCountriesInDropDown.push(preferredCountry[0]);
			});
		}
	}

	getSelectedCountry() {
		if (this.selectedCountryISO) {
			this.selectedCountry = this.allCountries.find(c => { return (c.iso2.toLowerCase() === this.selectedCountryISO.toLowerCase()) });
			if (this.selectedCountry) {
				if (this.phoneNumber) {
					this.onPhoneNumberChange();
				} else {
					this.propagateChange(null);
				}
			}
		}
	}


	/**
	 * Search country based on country name, iso2, dialCode or all of them.
	 */
	searchCountry() {
		if (!this.countrySearchText) {
			this.countryList.nativeElement.querySelector('li').scrollIntoView();
			return;
		}
		this.countrySearchText = this.countrySearchText.toLowerCase();
		const country = this.allCountries.filter(c => {
			if (this.searchCountryField.indexOf('iso2') > -1) {
				if (c.iso2.toLowerCase().startsWith(this.countrySearchText.toLowerCase())) {
					return c;
				}
			}
			if (this.searchCountryField.indexOf('name') > -1) {
				if (c.name.toLowerCase().startsWith(this.countrySearchText.toLowerCase())) {
					return c;
				}
			}
			if (this.searchCountryField.indexOf('dialCode') > -1) {
				if (c.dialCode.startsWith(this.countrySearchText)) {
					return c;
				}
			}
		});

		if (country.length > 0) {
			const el = this.countryList.nativeElement.querySelector('#' + country[0].iso2);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth' });
			}
		}
	}

	public onPhoneNumberChange(): void {
		this.value = this.phoneNumber;

		let number: lpn.PhoneNumber;
		try {
			number = this.phoneUtil.parse(this.phoneNumber, this.selectedCountry.iso2.toUpperCase());
		} catch (e) {
		}

		let countryCode = this.selectedCountry.iso2;
		// auto select country based on the extension (and areaCode if needed) (e.g select Canada if number starts with +1 416)
		if (this.enableAutoCountrySelect) {
			countryCode = number && number.getCountryCode()
				? this.getCountryIsoCode(number.getCountryCode(), number)
				: this.selectedCountry.iso2;
			if (countryCode !== this.selectedCountry.iso2) {
				const newCountry = this.allCountries.find(c => c.iso2 === countryCode);
				if (newCountry) {
					this.selectedCountry = newCountry;
				}
			}
		}
		countryCode = countryCode ? countryCode : this.selectedCountry.iso2;

		if (!this.value) {
			// tslint:disable-next-line:no-null-keyword
			this.propagateChange(null);
		} else {
			this.propagateChange({
				number: this.value,
				internationalNumber: number ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.INTERNATIONAL) : '',
				nationalNumber: number ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.NATIONAL) : '',
				countryCode: countryCode.toUpperCase(),
				dialCode: '+' + this.selectedCountry.dialCode
			});
		}
	}

	public onCountrySelect(country: Country, el): void {
		this.selectedCountry = country;

		if (this.phoneNumber.length > 0) {
			this.value = this.phoneNumber;

			let number: lpn.PhoneNumber;
			try {
				number = this.phoneUtil.parse(this.phoneNumber, this.selectedCountry.iso2.toUpperCase());
			} catch (e) {
			}

			this.propagateChange({
				number: this.value,
				internationalNumber: number ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.INTERNATIONAL) : '',
				nationalNumber: number ? this.phoneUtil.format(number, lpn.PhoneNumberFormat.NATIONAL) : '',
				countryCode: this.selectedCountry.iso2.toUpperCase(),
				dialCode: '+' + this.selectedCountry.dialCode
			});
		}

		el.focus();
	}

	public onInputKeyPress(event: KeyboardEvent): void {
		const allowedChars = /[0-9\+\-\ ]/;
		const allowedCtrlChars = /[axcv]/; // Allows copy-pasting
		const allowedOtherKeys = [
			'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown',
			'Home', 'End', 'Insert', 'Delete', 'Backspace'
		];

		if (!allowedChars.test(event.key)
			&& !(event.ctrlKey && allowedCtrlChars.test(event.key))
			&& !(allowedOtherKeys.includes(event.key))) {
			event.preventDefault();
		}
	}

	protected fetchCountryData(): void {
		this.countryCodeData.allCountries.forEach(c => {
			const country: Country = {
				name: c[0].toString(),
				iso2: c[1].toString(),
				dialCode: c[2].toString(),
				priority: +c[3] || 0,
				areaCodes: c[4] as string[] || undefined,
				flagClass: c[1].toString().toLocaleLowerCase(),
				placeHolder: ''
			};

			if (this.enablePlaceholder) {
				country.placeHolder = this.getPhoneNumberPlaceHolder(country.iso2.toUpperCase());
			}

			this.allCountries.push(country);
		});
	}

	protected getPhoneNumberPlaceHolder(countryCode: string): string {
		try {
			return this.phoneUtil.format(this.phoneUtil.getExampleNumber(countryCode), lpn.PhoneNumberFormat.INTERNATIONAL);
		} catch (e) {
			return e;
		}
	}

	registerOnChange(fn: any): void {
		this.propagateChange = fn;
	}

	registerOnTouched(fn: any) {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	writeValue(obj: any): void {
		if (typeof obj !== 'object') {
			this.phoneNumber = obj;
		}
		setTimeout(() => {
			this.onPhoneNumberChange();
		}, 1);
	}

	private getCountryIsoCode(countryCode: number, number: lpn.PhoneNumber): string | undefined {
		// Will use this to match area code from the first numbers
		const rawNumber = number.values_['2'].toString();
		// List of all countries with countryCode (can be more than one. e.x. US, CA, DO, PR all have +1 countryCode)
		const countries = this.allCountries.filter(c => c.dialCode === countryCode.toString());
		// Main country is the country, which has no areaCodes specified in country-code.ts file.
		const mainCountry = countries.find(c => c.areaCodes === undefined);
		// Secondary countries are all countries, which have areaCodes specified in country-code.ts file.
		const secondaryCountries = countries.filter(c => c.areaCodes !== undefined);
		let matchedCountry = mainCountry ? mainCountry.iso2 : undefined;

		/*
			Interate over each secondary country and check if nationalNumber starts with any of areaCodes available.
			If no matches found, fallback to the main country.
		*/
		secondaryCountries.forEach(country => {
			country.areaCodes.forEach(areaCode => {
				if (rawNumber.startsWith(areaCode)) {
					matchedCountry = country.iso2;
				}
			});
		});

		return matchedCountry;
	}

}
