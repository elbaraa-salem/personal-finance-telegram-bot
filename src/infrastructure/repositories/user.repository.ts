import { UserDocument, UserModel } from "../database/models/user.model";
import { ExpenseScopeMode } from "../database/models/user.model";
import { SupportedLanguage } from "../../bot/i18n/language";

type CreateUserData = {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    language?: SupportedLanguage;
    currency?: string;
};

export class UserRepository {
    async findByTelegramId(telegramId: number): Promise<UserDocument | null> {
        return UserModel.findOne({ telegramId }).exec(); 
    }

    async create(data: CreateUserData): Promise<UserDocument>{
        return UserModel.create(data);
    }

    async updateLanguageByTelegramId(
        telegramId: number,
        language: SupportedLanguage
    ): Promise<UserDocument | null> {
        return UserModel.findOneAndUpdate(
            { telegramId },
            { $set: { language } },
            { returnDocument: "after" }
        ).exec();
    }

    async updateCurrencyByTelegramId(
    telegramId: number,
    currency: string
    ): Promise<UserDocument | null> {
    return UserModel.findOneAndUpdate(
        { telegramId },
        { $set: { currency } },
        { returnDocument: "after" }
    ).exec();
    }

    async updateExpenseScopeModeByTelegramId(
        telegramId: number,
        expenseScopeMode: ExpenseScopeMode
    ): Promise<UserDocument | null> {
        return UserModel.findOneAndUpdate(
            { telegramId },
            { $set: { expenseScopeMode } },
            { returnDocument: "after" }
        ).exec();
    }

    async updateTimezoneByTelegramId(
        telegramId: number,
        timezone: string
    ): Promise<UserDocument | null> {
        return UserModel.findOneAndUpdate(
            { telegramId },
            { $set: { timezone } },
            { returnDocument: "after" }
        ).exec();
    }
}
